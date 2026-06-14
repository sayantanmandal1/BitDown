use tauri::State;
use sqlx::Row;
use uuid::Uuid;

use crate::{
    AppState,
    db::SpeedSample,
    engine::{TorrentFileInfo, TorrentSummary, PeerInfo, TrackerInfo},
};

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
pub async fn add_torrent_file(
    state: State<'_, AppState>,
    path: String,
    save_path: String,
    paused: bool,
    category: Option<String>,
    label: Option<String>,
    skip_hash_check: bool,
) -> CmdResult<crate::engine::TorrentRecord> {
    let uuid = Uuid::new_v4().to_string();
    let mut record = state.manager
        .add_from_file(&uuid, &path, &save_path, paused)
        .await
        .map_err(err)?;
    record.category = category;
    record.label = label;
    if record.category.is_some() || record.label.is_some() {
        state.db.insert_torrent(&record).await.map_err(err)?;
    }
    // Auto-fetch metadata in background
    let mgr = state.manager.clone();
    let db = state.db.clone();
    let name = record.name.clone();
    let id = record.id.clone();
    tokio::spawn(async move {
        let settings = mgr.settings.read().await;
        if settings.tmdb_api_key.is_empty() { return; }
        let client = crate::intelligence::MetadataClient::new(settings.tmdb_api_key.clone());
        drop(settings);
        if let Ok(Some(meta)) = client.auto_fetch(&name).await {
            let _ = db.insert_metadata(&meta).await;
            let _ = db.update_torrent_metadata(&id, &meta.id, &meta.media_type).await;
        }
    });
    Ok(record)
}

#[tauri::command]
pub async fn add_torrent_magnet(
    state: State<'_, AppState>,
    magnet: String,
    save_path: String,
    paused: bool,
    category: Option<String>,
    label: Option<String>,
) -> CmdResult<crate::engine::TorrentRecord> {
    let uuid = Uuid::new_v4().to_string();
    let mut record = state.manager
        .add_from_magnet(&uuid, &magnet, &save_path, paused)
        .await
        .map_err(err)?;
    record.category = category;
    record.label = label;
    Ok(record)
}

#[tauri::command]
pub async fn remove_torrent(
    state: State<'_, AppState>,
    id: String,
    delete_files: bool,
) -> CmdResult<()> {
    state.manager.remove_torrent(&id, delete_files).await.map_err(err)
}

#[tauri::command]
pub async fn pause_torrent(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.manager.pause_torrent(&id).await.map_err(err)
}

#[tauri::command]
pub async fn resume_torrent(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.manager.resume_torrent(&id).await.map_err(err)
}

#[tauri::command]
pub async fn get_all_torrents(state: State<'_, AppState>) -> CmdResult<Vec<TorrentSummary>> {
    Ok(state.manager.get_all_summaries().await)
}

#[tauri::command]
pub async fn get_torrent_details(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<Option<crate::engine::TorrentRecord>> {
    state.db.get_torrent(&id).await.map_err(err)
}

#[tauri::command]
pub async fn get_torrent_files(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<Vec<TorrentFileInfo>> {
    Ok(state.manager.get_files(&id).await)
}

#[tauri::command]
pub async fn get_torrent_peers(
    _state: State<'_, AppState>,
    _id: String,
) -> CmdResult<Vec<PeerInfo>> {
    // librqbit v8 doesn't expose individual peer details via public API
    // Returns empty list — peer count is available in TorrentProgress
    Ok(vec![])
}

#[tauri::command]
pub async fn get_torrent_trackers(
    _state: State<'_, AppState>,
    _id: String,
) -> CmdResult<Vec<TrackerInfo>> {
    // librqbit v8 doesn't expose tracker stats via public API
    Ok(vec![])
}

#[tauri::command]
pub async fn set_file_priority(
    state: State<'_, AppState>,
    torrent_id: String,
    file_index: usize,
    priority: u8, // 0=skip, 1=low, 4=normal, 7=high
) -> CmdResult<()> {
    // librqbit uses file inclusion; map 0 to excluded, >0 to included
    // TODO: when librqbit exposes per-file priority, wire it here
    let _ = state.manager.get_lt_id(&torrent_id).await;
    Ok(())
}

#[tauri::command]
pub async fn set_torrent_priority(
    state: State<'_, AppState>,
    id: String,
    priority: i64,
) -> CmdResult<()> {
    sqlx::query("UPDATE torrents SET priority = ? WHERE id = ?")
        .bind(priority).bind(&id)
        .execute(state.db.pool()).await.map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn force_recheck(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.manager.force_recheck(&id).await.map_err(err)
}

#[tauri::command]
pub async fn open_download_folder(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<()> {
    if let Some(record) = state.db.get_torrent(&id).await.map_err(err)? {
        open::that(record.save_path).map_err(err)?;
    }
    Ok(())
}

#[tauri::command]
pub async fn create_torrent(
    state: State<'_, AppState>,
    source_path: String,
    output_path: String,
    trackers: Vec<String>,
    piece_size: Option<u32>,
    comment: Option<String>,
) -> CmdResult<String> {
    // Use librqbit's torrent creation (if available) or return a placeholder
    Err("Torrent creation not yet implemented in this build".to_string())
}

#[tauri::command]
pub async fn get_torrent_piece_map(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<Vec<u8>> {
    Ok(state.manager.get_piece_map(&id).await.unwrap_or_default())
}

#[tauri::command]
pub async fn get_speed_history(
    state: State<'_, AppState>,
    torrent_id: Option<String>,
    seconds: i64,
) -> CmdResult<Vec<SpeedSample>> {
    state.db
        .get_speed_history(torrent_id.as_deref(), seconds)
        .await
        .map_err(err)
}

#[tauri::command]
pub async fn set_torrent_label(
    state: State<'_, AppState>,
    id: String,
    label: Option<String>,
) -> CmdResult<()> {
    state.db.update_torrent_label(&id, label.as_deref()).await.map_err(err)
}

#[tauri::command]
pub async fn set_download_limit(
    state: State<'_, AppState>,
    id: String,
    bytes_per_sec: Option<i64>,
) -> CmdResult<()> {
    sqlx::query("UPDATE torrents SET download_limit = ? WHERE id = ?")
        .bind(bytes_per_sec).bind(&id)
        .execute(state.db.pool()).await.map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn set_upload_limit(
    state: State<'_, AppState>,
    id: String,
    bytes_per_sec: Option<i64>,
) -> CmdResult<()> {
    sqlx::query("UPDATE torrents SET upload_limit = ? WHERE id = ?")
        .bind(bytes_per_sec).bind(&id)
        .execute(state.db.pool()).await.map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn set_max_peers(
    state: State<'_, AppState>,
    id: String,
    max: Option<i64>,
) -> CmdResult<()> {
    sqlx::query("UPDATE torrents SET max_peers = ? WHERE id = ?")
        .bind(max).bind(&id)
        .execute(state.db.pool()).await.map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn add_tracker(
    _state: State<'_, AppState>,
    torrent_id: String,
    url: String,
) -> CmdResult<()> {
    // TODO: wire to librqbit announce when API is available
    tracing::info!("Adding tracker {} to {}", url, torrent_id);
    Ok(())
}

#[tauri::command]
pub async fn remove_tracker(
    _state: State<'_, AppState>,
    torrent_id: String,
    url: String,
) -> CmdResult<()> {
    tracing::info!("Removing tracker {} from {}", url, torrent_id);
    Ok(())
}
