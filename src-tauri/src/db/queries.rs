use anyhow::Result;
use sqlx::Row;

use crate::db::Database;
use crate::engine::TorrentRecord;
use crate::rss::{RssFeed, RssFilterRule};
use crate::intelligence::MetadataRecord;
use crate::commands::settings::WebhookConfig;

impl Database {
    // ─── Torrent CRUD ────────────────────────────────────────────────────────

    pub async fn insert_torrent(&self, t: &TorrentRecord) -> Result<()> {
        sqlx::query(
            "INSERT OR REPLACE INTO torrents (id,name,info_hash,magnet_uri,torrent_file_path,save_path,status,category,label,added_at,completed_at,total_size,downloaded,uploaded,download_limit,upload_limit,max_peers,sequential_download,priority,metadata_id,metadata_type,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(&t.id).bind(&t.name).bind(&t.info_hash).bind(&t.magnet_uri).bind(&t.torrent_file_path)
        .bind(&t.save_path).bind(&t.status).bind(&t.category).bind(&t.label)
        .bind(t.added_at).bind(t.completed_at).bind(t.total_size).bind(t.downloaded).bind(t.uploaded)
        .bind(t.download_limit).bind(t.upload_limit).bind(t.max_peers).bind(t.sequential_download)
        .bind(t.priority).bind(&t.metadata_id).bind(&t.metadata_type).bind(&t.notes)
        .execute(self.pool()).await?;
        Ok(())
    }

    pub async fn delete_torrent(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM torrents WHERE id = ?").bind(id).execute(self.pool()).await?;
        Ok(())
    }

    pub async fn get_all_torrents(&self) -> Result<Vec<TorrentRecord>> {
        let rows = sqlx::query("SELECT * FROM torrents ORDER BY added_at DESC").fetch_all(self.pool()).await?;
        Ok(rows.into_iter().map(row_to_torrent).collect())
    }

    pub async fn get_torrent(&self, id: &str) -> Result<Option<TorrentRecord>> {
        let row = sqlx::query("SELECT * FROM torrents WHERE id = ?").bind(id).fetch_optional(self.pool()).await?;
        Ok(row.map(row_to_torrent))
    }

    pub async fn update_torrent_label(&self, id: &str, label: Option<&str>) -> Result<()> {
        sqlx::query("UPDATE torrents SET label = ? WHERE id = ?").bind(label).bind(id).execute(self.pool()).await?;
        Ok(())
    }

    pub async fn update_torrent_metadata(&self, id: &str, metadata_id: &str, metadata_type: &str) -> Result<()> {
        sqlx::query("UPDATE torrents SET metadata_id = ?, metadata_type = ? WHERE id = ?")
            .bind(metadata_id).bind(metadata_type).bind(id).execute(self.pool()).await?;
        Ok(())
    }

    // ─── RSS ─────────────────────────────────────────────────────────────────

    pub async fn insert_rss_feed(&self, f: &RssFeed) -> Result<()> {
        sqlx::query("INSERT INTO rss_feeds (id,name,url,enabled,interval_minutes,created_at) VALUES (?,?,?,?,?,?)")
            .bind(&f.id).bind(&f.name).bind(&f.url).bind(f.enabled).bind(f.interval_minutes).bind(f.created_at)
            .execute(self.pool()).await?;
        Ok(())
    }

    pub async fn delete_rss_feed(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM rss_feeds WHERE id = ?").bind(id).execute(self.pool()).await?;
        Ok(())
    }

    pub async fn get_rss_feeds(&self) -> Result<Vec<RssFeed>> {
        let rows = sqlx::query("SELECT * FROM rss_feeds ORDER BY created_at ASC").fetch_all(self.pool()).await?;
        Ok(rows.into_iter().map(|r| RssFeed {
            id: r.get("id"), name: r.get("name"), url: r.get("url"),
            enabled: r.get("enabled"), interval_minutes: r.get("interval_minutes"),
            last_fetched: r.get("last_fetched"), created_at: r.get("created_at"),
        }).collect())
    }

    pub async fn update_rss_last_fetched(&self, id: &str, ts: i64) -> Result<()> {
        sqlx::query("UPDATE rss_feeds SET last_fetched = ? WHERE id = ?").bind(ts).bind(id).execute(self.pool()).await?;
        Ok(())
    }

    pub async fn insert_rss_filter(&self, r: &RssFilterRule) -> Result<()> {
        sqlx::query(
            "INSERT INTO rss_filter_rules (id,feed_id,name,pattern,exclude_pattern,min_size,max_size,save_path,category,label,enabled,quality_filter,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(&r.id).bind(&r.feed_id).bind(&r.name).bind(&r.pattern).bind(&r.exclude_pattern)
        .bind(r.min_size).bind(r.max_size).bind(&r.save_path).bind(&r.category).bind(&r.label)
        .bind(r.enabled).bind(&r.quality_filter).bind(r.created_at)
        .execute(self.pool()).await?;
        Ok(())
    }

    pub async fn delete_rss_filter(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM rss_filter_rules WHERE id = ?").bind(id).execute(self.pool()).await?;
        Ok(())
    }

    pub async fn get_rss_filters(&self, feed_id: Option<&str>) -> Result<Vec<RssFilterRule>> {
        let rows = if let Some(fid) = feed_id {
            sqlx::query("SELECT * FROM rss_filter_rules WHERE feed_id = ? ORDER BY created_at ASC").bind(fid).fetch_all(self.pool()).await?
        } else {
            sqlx::query("SELECT * FROM rss_filter_rules ORDER BY created_at ASC").fetch_all(self.pool()).await?
        };
        Ok(rows.into_iter().map(|r| RssFilterRule {
            id: r.get("id"), feed_id: r.get("feed_id"), name: r.get("name"), pattern: r.get("pattern"),
            exclude_pattern: r.get("exclude_pattern"), min_size: r.get("min_size"), max_size: r.get("max_size"),
            save_path: r.get("save_path"), category: r.get("category"), label: r.get("label"),
            enabled: r.get("enabled"), quality_filter: r.get("quality_filter"), created_at: r.get("created_at"),
        }).collect())
    }

    // ─── Metadata ────────────────────────────────────────────────────────────

    pub async fn insert_metadata(&self, m: &MetadataRecord) -> Result<()> {
        let genres = serde_json::to_string(&m.genres).unwrap_or_default();
        sqlx::query(
            "INSERT OR REPLACE INTO metadata_cache (id,media_type,title,year,overview,poster_url,backdrop_url,rating,genres,tmdb_id,cached_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)"
        )
        .bind(&m.id).bind(&m.media_type).bind(&m.title).bind(m.year).bind(&m.overview)
        .bind(&m.poster_url).bind(&m.backdrop_url).bind(m.rating).bind(&genres).bind(m.tmdb_id).bind(m.cached_at)
        .execute(self.pool()).await?;
        Ok(())
    }

    pub async fn get_metadata(&self, id: &str) -> Result<Option<MetadataRecord>> {
        let row = sqlx::query("SELECT * FROM metadata_cache WHERE id = ?").bind(id).fetch_optional(self.pool()).await?;
        Ok(row.map(|r| {
            let genres_str: String = r.get::<Option<String>, _>("genres").unwrap_or_default();
            MetadataRecord {
                id: r.get("id"), media_type: r.get("media_type"), title: r.get("title"),
                year: r.get("year"), overview: r.get("overview"), poster_url: r.get("poster_url"),
                backdrop_url: r.get("backdrop_url"), rating: r.get("rating"),
                genres: serde_json::from_str(&genres_str).unwrap_or_default(),
                tmdb_id: r.get("tmdb_id"), cached_at: r.get("cached_at"),
            }
        }))
    }

    // ─── Webhooks ────────────────────────────────────────────────────────────

    pub async fn get_webhooks(&self) -> Result<Vec<WebhookConfig>> {
        let rows = sqlx::query("SELECT id,name,url,events,enabled FROM webhooks ORDER BY created_at ASC").fetch_all(self.pool()).await?;
        Ok(rows.into_iter().map(|r| {
            let events_str: String = r.get::<Option<String>, _>("events").unwrap_or_default();
            WebhookConfig {
                id: r.get("id"), name: r.get("name"), url: r.get("url"),
                events: serde_json::from_str(&events_str).unwrap_or_default(),
                enabled: r.get::<i64, _>("enabled") != 0,
            }
        }).collect())
    }

    pub async fn insert_webhook(&self, w: &WebhookConfig) -> Result<()> {
        let events = serde_json::to_string(&w.events)?;
        let now = chrono::Utc::now().timestamp();
        let enabled = w.enabled as i64;
        sqlx::query("INSERT INTO webhooks (id,name,url,events,enabled,created_at) VALUES (?,?,?,?,?,?)")
            .bind(&w.id).bind(&w.name).bind(&w.url).bind(&events).bind(enabled).bind(now)
            .execute(self.pool()).await?;
        Ok(())
    }

    pub async fn delete_webhook(&self, id: &str) -> Result<()> {
        sqlx::query("DELETE FROM webhooks WHERE id = ?").bind(id).execute(self.pool()).await?;
        Ok(())
    }
}

fn row_to_torrent(r: sqlx::sqlite::SqliteRow) -> TorrentRecord {
    TorrentRecord {
        id: r.get("id"), name: r.get("name"), info_hash: r.get("info_hash"),
        magnet_uri: r.get("magnet_uri"), torrent_file_path: r.get("torrent_file_path"),
        save_path: r.get("save_path"), status: r.get("status"), category: r.get("category"),
        label: r.get("label"), added_at: r.get("added_at"), completed_at: r.get("completed_at"),
        total_size: r.get("total_size"), downloaded: r.get("downloaded"), uploaded: r.get("uploaded"),
        download_limit: r.get("download_limit"), upload_limit: r.get("upload_limit"),
        max_peers: r.get("max_peers"), sequential_download: r.get("sequential_download"),
        priority: r.get("priority"), metadata_id: r.get("metadata_id"),
        metadata_type: r.get("metadata_type"), notes: r.get("notes"),
    }
}

