use tauri::State;
use uuid::Uuid;
use crate::{AppState, rss::{RssFeed, RssFilterRule, RssManager}};

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
pub async fn add_feed(
    state: State<'_, AppState>,
    name: String,
    url: String,
    interval_minutes: i64,
) -> CmdResult<RssFeed> {
    let feed = RssFeed {
        id: Uuid::new_v4().to_string(),
        name,
        url,
        enabled: 1,
        interval_minutes,
        last_fetched: None,
        created_at: chrono::Utc::now().timestamp(),
    };
    state.db.insert_rss_feed(&feed).await.map_err(err)?;
    Ok(feed)
}

#[tauri::command]
pub async fn remove_feed(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.db.delete_rss_feed(&id).await.map_err(err)
}

#[tauri::command]
pub async fn get_feeds(state: State<'_, AppState>) -> CmdResult<Vec<RssFeed>> {
    state.db.get_rss_feeds().await.map_err(err)
}

#[tauri::command]
pub async fn refresh_feed(
    _state: State<'_, AppState>,
    url: String,
) -> CmdResult<Vec<crate::rss::RssItem>> {
    RssManager::fetch_feed(&url).await.map_err(err)
}

#[tauri::command]
pub async fn add_filter_rule(
    state: State<'_, AppState>,
    feed_id: Option<String>,
    name: String,
    pattern: String,
    exclude_pattern: Option<String>,
    min_size: Option<i64>,
    max_size: Option<i64>,
    save_path: Option<String>,
    category: Option<String>,
    label: Option<String>,
    quality_filter: Option<String>,
) -> CmdResult<RssFilterRule> {
    let rule = RssFilterRule {
        id: Uuid::new_v4().to_string(),
        feed_id,
        name,
        pattern,
        exclude_pattern,
        min_size,
        max_size,
        save_path,
        category,
        label,
        enabled: 1,
        quality_filter,
        created_at: chrono::Utc::now().timestamp(),
    };
    state.db.insert_rss_filter(&rule).await.map_err(err)?;
    Ok(rule)
}

#[tauri::command]
pub async fn remove_filter_rule(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.db.delete_rss_filter(&id).await.map_err(err)
}

#[tauri::command]
pub async fn get_filter_rules(
    state: State<'_, AppState>,
    feed_id: Option<String>,
) -> CmdResult<Vec<RssFilterRule>> {
    state.db.get_rss_filters(feed_id.as_deref()).await.map_err(err)
}
