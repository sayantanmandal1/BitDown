use sqlx::Row;
use tauri::State;
use crate::{
    AppState,
    privacy::{ProxyConfig, Blocklist, check_ip_leak},
};

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
pub async fn set_proxy_config(state: State<'_, AppState>, config: ProxyConfig) -> CmdResult<()> {
    let json = serde_json::to_string(&config).map_err(err)?;
    state.db.save_setting("proxy_config", &json).await.map_err(err)
}

#[tauri::command]
pub async fn get_proxy_config(state: State<'_, AppState>) -> CmdResult<ProxyConfig> {
    let row = sqlx::query("SELECT value FROM settings WHERE key = 'proxy_config'")
        .fetch_optional(state.db.pool()).await.map_err(err)?;
    if let Some(r) = row {
        let v: String = r.get("value");
        serde_json::from_str(&v).map_err(err)
    } else {
        Ok(ProxyConfig::default())
    }
}

#[tauri::command]
pub async fn test_proxy(state: State<'_, AppState>, config: ProxyConfig) -> CmdResult<String> {
    crate::privacy::do_test_proxy(&config).await.map_err(err)
}

#[tauri::command]
pub async fn load_blocklist(state: State<'_, AppState>, path: String) -> CmdResult<usize> {
    let bl = Blocklist::load_from_file(&path).map_err(err)?;
    let count = bl.count();
    state.db.save_setting("blocklist_path", &path).await.map_err(err)?;
    state.db.save_setting("blocklist_count", &count.to_string()).await.map_err(err)?;
    Ok(count)
}

#[tauri::command]
pub async fn get_blocklist_stats(state: State<'_, AppState>) -> CmdResult<serde_json::Value> {
    let path_row = sqlx::query("SELECT value FROM settings WHERE key = 'blocklist_path'")
        .fetch_optional(state.db.pool()).await.map_err(err)?;
    let path: Option<String> = path_row.map(|r| r.get("value"));

    let count_row = sqlx::query("SELECT value FROM settings WHERE key = 'blocklist_count'")
        .fetch_optional(state.db.pool()).await.map_err(err)?;
    let count: usize = count_row.and_then(|r| {
        let v: String = r.get("value");
        v.parse().ok()
    }).unwrap_or(0);

    Ok(serde_json::json!({ "path": path, "count": count, "enabled": count > 0 }))
}

#[tauri::command]
pub async fn set_killswitch(state: State<'_, AppState>, enabled: bool) -> CmdResult<()> {
    state.db.save_setting("killswitch_enabled", if enabled { "1" } else { "0" }).await.map_err(err)
}

#[tauri::command]
pub async fn test_ip_leak() -> CmdResult<Vec<String>> {
    check_ip_leak().await.map_err(err)
}

