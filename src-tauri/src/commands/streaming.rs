use tauri::State;
use crate::AppState;

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
pub async fn start_stream(state: State<'_, AppState>, torrent_id: String, file_index: usize) -> CmdResult<String> {
    // Switch to sequential download mode for streaming
    sqlx::query("UPDATE torrents SET sequential_download = 1 WHERE id = ?")
        .bind(&torrent_id)
        .execute(state.db.pool())
        .await
        .map_err(err)?;
    Ok(state.streaming.stream_url(&torrent_id, file_index))
}

#[tauri::command]
pub async fn stop_stream(state: State<'_, AppState>, torrent_id: String) -> CmdResult<()> {
    sqlx::query("UPDATE torrents SET sequential_download = 0 WHERE id = ?")
        .bind(&torrent_id)
        .execute(state.db.pool())
        .await
        .map_err(err)?;
    Ok(())
}

#[tauri::command]
pub async fn get_stream_url(state: State<'_, AppState>, torrent_id: String, file_index: usize, use_hls: bool) -> CmdResult<String> {
    if use_hls {
        Ok(state.streaming.hls_url(&torrent_id, file_index))
    } else {
        Ok(state.streaming.stream_url(&torrent_id, file_index))
    }
}

