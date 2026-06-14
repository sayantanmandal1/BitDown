use anyhow::Result;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tokio::time::{interval, Duration};
use tracing::{error, info};
use uuid::Uuid;

use crate::{db::Database, engine::TorrentManager};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RssFeed {
    pub id: String,
    pub name: String,
    pub url: String,
    pub enabled: i64,
    pub interval_minutes: i64,
    pub last_fetched: Option<i64>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RssFilterRule {
    pub id: String,
    pub feed_id: Option<String>,
    pub name: String,
    pub pattern: String,
    pub exclude_pattern: Option<String>,
    pub min_size: Option<i64>,
    pub max_size: Option<i64>,
    pub save_path: Option<String>,
    pub category: Option<String>,
    pub label: Option<String>,
    pub enabled: i64,
    pub quality_filter: Option<String>,
    pub created_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RssItem {
    pub title: String,
    pub link: String,
    pub size: Option<u64>,
    pub pub_date: Option<String>,
    pub description: Option<String>,
}

pub struct RssManager {
    db: Arc<Database>,
    manager: Arc<TorrentManager>,
}

impl RssManager {
    pub fn new(db: Arc<Database>, manager: Arc<TorrentManager>) -> Self {
        Self { db, manager }
    }

    /// Fetch items from a single RSS feed URL.
    pub async fn fetch_feed(url: &str) -> Result<Vec<RssItem>> {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_secs(30))
            .user_agent("BitDown/0.1")
            .build()?;
        let body = client.get(url).send().await?.text().await?;

        let mut items = Vec::new();

        // Try RSS 2.0
        if let Ok(channel) = body.parse::<rss::Channel>() {
            for item in channel.items() {
                let size = item.enclosure().and_then(|e| e.length().parse::<u64>().ok());
                items.push(RssItem {
                    title: item.title().unwrap_or("").to_string(),
                    link: item
                        .enclosure()
                        .map(|e| e.url().to_string())
                        .or_else(|| item.link().map(|l| l.to_string()))
                        .unwrap_or_default(),
                    size,
                    pub_date: item.pub_date().map(|d| d.to_string()),
                    description: item.description().map(|d| d.to_string()),
                });
            }
        }
        // Try Atom
        else if let Ok(feed) = body.parse::<atom_syndication::Feed>() {
            for entry in feed.entries() {
                let link = entry.links().first().map(|l| l.href().to_string()).unwrap_or_default();
                items.push(RssItem {
                    title: entry.title().value.clone(),
                    link,
                    size: None,
                    pub_date: Some(entry.updated().to_string()),
                    description: entry.summary().map(|s| s.value.clone()),
                });
            }
        }

        Ok(items)
    }

    /// Apply filter rules to an item list and return matching items with their rules.
    pub fn apply_filters<'a>(
        items: &'a [RssItem],
        rules: &'a [RssFilterRule],
    ) -> Vec<(&'a RssItem, &'a RssFilterRule)> {
        let mut matches = Vec::new();

        for item in items {
            for rule in rules {
                if rule.enabled == 0 { continue; }

                // Title pattern match
                let pattern_re = match Regex::new(&format!("(?i){}", rule.pattern)) {
                    Ok(r) => r,
                    Err(_) => continue,
                };
                if !pattern_re.is_match(&item.title) { continue; }

                // Exclude pattern
                if let Some(excl) = &rule.exclude_pattern {
                    if let Ok(excl_re) = Regex::new(&format!("(?i){}", excl)) {
                        if excl_re.is_match(&item.title) { continue; }
                    }
                }

                // Size filter
                if let Some(size) = item.size {
                    if let Some(min) = rule.min_size {
                        if (size as i64) < min { continue; }
                    }
                    if let Some(max) = rule.max_size {
                        if (size as i64) > max { continue; }
                    }
                }

                // Quality filter (1080p, 720p, etc.)
                if let Some(qual) = &rule.quality_filter {
                    if !qual.is_empty() {
                        let qual_re = Regex::new(&format!("(?i){}", qual)).unwrap();
                        if !qual_re.is_match(&item.title) { continue; }
                    }
                }

                matches.push((item, rule));
                break; // First matching rule wins
            }
        }

        matches
    }

    /// Start the background RSS polling task.
    pub fn start_polling(self: Arc<Self>) {
        tokio::spawn(async move {
            let mut ticker = interval(Duration::from_secs(60));
            loop {
                ticker.tick().await;
                let feeds = match self.db.get_rss_feeds().await {
                    Ok(f) => f,
                    Err(e) => { error!("RSS: DB error: {}", e); continue; }
                };

                let now = chrono::Utc::now().timestamp();
                for feed in feeds {
                    if feed.enabled == 0 { continue; }
                    let interval_secs = feed.interval_minutes * 60;
                    let due = feed.last_fetched
                        .map(|lf| now - lf >= interval_secs)
                        .unwrap_or(true);
                    if !due { continue; }

                    info!("RSS: Fetching feed '{}' from {}", feed.name, feed.url);
                    let items = match Self::fetch_feed(&feed.url).await {
                        Ok(i) => i,
                        Err(e) => { error!("RSS: Fetch failed for {}: {}", feed.url, e); continue; }
                    };

                    let rules = self.db.get_rss_filters(Some(&feed.id)).await.unwrap_or_default();
                    let matches = Self::apply_filters(&items, &rules);

                    for (item, rule) in matches {
                        let save_path = rule.save_path.as_deref()
                            .unwrap_or("");
                        let uuid = Uuid::new_v4().to_string();

                        // Add the torrent
                        let result = if item.link.starts_with("magnet:") {
                            self.manager.add_from_magnet(&uuid, &item.link, save_path, false).await
                        } else {
                            // Download .torrent file first
                            if let Ok(bytes) = reqwest::get(&item.link).await
                                .and_then(|r| Ok(r))
                            {
                                if let Ok(bytes) = bytes.bytes().await {
                                    let tmp = std::env::temp_dir()
                                        .join(format!("{}.torrent", uuid));
                                    std::fs::write(&tmp, &bytes).ok();
                                    self.manager.add_from_file(
                                        &uuid,
                                        tmp.to_str().unwrap_or(""),
                                        save_path,
                                        false,
                                    ).await
                                } else {
                                    Err(anyhow::anyhow!("Failed to read bytes"))
                                }
                            } else {
                                Err(anyhow::anyhow!("Failed to download torrent"))
                            }
                        };

                        match result {
                            Ok(rec) => info!("RSS: Auto-added '{}' from feed '{}'", rec.name, feed.name),
                            Err(e) => error!("RSS: Failed to add '{}': {}", item.title, e),
                        }
                    }

                    let _ = self.db.update_rss_last_fetched(&feed.id, now).await;
                }
            }
        });
    }
}
