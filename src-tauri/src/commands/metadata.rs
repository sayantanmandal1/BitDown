use tauri::State;
use crate::{AppState, intelligence::{MetadataClient, MetadataRecord}};

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[tauri::command]
pub async fn fetch_metadata(
    state: State<'_, AppState>,
    torrent_id: String,
) -> CmdResult<Option<MetadataRecord>> {
    let record = state.db.get_torrent(&torrent_id).await.map_err(err)?
        .ok_or_else(|| "Torrent not found".to_string())?;

    let settings = state.manager.settings.read().await;
    let api_key = settings.tmdb_api_key.clone();
    drop(settings);

    if api_key.is_empty() {
        return Err("TMDB API key not configured".to_string());
    }

    let client = MetadataClient::new(api_key);
    let meta = client.auto_fetch(&record.name).await.map_err(err)?;

    if let Some(ref m) = meta {
        state.db.insert_metadata(m).await.map_err(err)?;
        state.db.update_torrent_metadata(&torrent_id, &m.id, &m.media_type).await.map_err(err)?;
    }

    Ok(meta)
}

#[tauri::command]
pub async fn search_tmdb(
    state: State<'_, AppState>,
    query: String,
) -> CmdResult<Vec<crate::intelligence::TmdbSearchResult>> {
    let settings = state.manager.settings.read().await;
    let api_key = settings.tmdb_api_key.clone();
    drop(settings);

    if api_key.is_empty() {
        return Err("TMDB API key not configured".to_string());
    }

    let client = MetadataClient::new(api_key);
    client.search_multi(&query).await.map_err(err)
}

#[tauri::command]
pub async fn get_cached_metadata(
    state: State<'_, AppState>,
    id: String,
) -> CmdResult<Option<MetadataRecord>> {
    state.db.get_metadata(&id).await.map_err(err)
}

#[tauri::command]
pub async fn auto_organize(
    state: State<'_, AppState>,
    torrent_id: String,
    template: String,
    dry_run: bool,
) -> CmdResult<Vec<(String, String)>> {
    let record = state.db.get_torrent(&torrent_id).await.map_err(err)?
        .ok_or_else(|| "Torrent not found".to_string())?;

    let meta = if let Some(mid) = &record.metadata_id {
        state.db.get_metadata(mid).await.map_err(err)?
    } else {
        None
    };

    let meta = meta.unwrap_or_else(|| MetadataRecord {
        id: "".to_string(),
        media_type: "other".to_string(),
        title: record.name.clone(),
        year: None,
        overview: None,
        poster_url: None,
        backdrop_url: None,
        rating: None,
        genres: vec![],
        tmdb_id: None,
        cached_at: 0,
    });

    let files = state.manager.get_files(&torrent_id).await;
    let mut moves = Vec::new();

    for file in &files {
        let filename = std::path::Path::new(&file.path)
            .file_name()
            .and_then(|n| n.to_str())
            .unwrap_or(&file.path);

        let dest_rel = crate::intelligence::resolve_organize_path(&template, &meta, filename);
        let settings = state.manager.settings.read().await;
        let base = settings.default_download_path.clone();
        drop(settings);
        let src = std::path::Path::new(&record.save_path).join(&file.path);
        let dst = std::path::Path::new(&base).join(&dest_rel);

        if !dry_run && src.exists() {
            if let Some(parent) = dst.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            std::fs::rename(&src, &dst).map_err(err)?;
        }

        moves.push((
            src.to_string_lossy().to_string(),
            dst.to_string_lossy().to_string(),
        ));
    }

    Ok(moves)
}

#[tauri::command]
pub async fn preview_organize(
    state: State<'_, AppState>,
    torrent_id: String,
    template: String,
) -> CmdResult<Vec<(String, String)>> {
    auto_organize(state, torrent_id, template, true).await
}
