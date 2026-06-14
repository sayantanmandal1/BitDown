use anyhow::Result;
use axum::{
    body::Body,
    extract::{Path, State},
    http::{header, HeaderMap, StatusCode},
    response::Response,
    routing::get,
    Router,
};
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::{db::Database, engine::TorrentManager};

pub struct StreamingServer {
    pub port: u16,
    manager: Arc<TorrentManager>,
}

#[derive(Clone)]
struct StreamState {
    manager: Arc<TorrentManager>,
    db: Arc<Database>,
}

impl StreamingServer {
    pub async fn new(manager: Arc<TorrentManager>) -> Result<Self> {
        let port = 54321u16;
        let db = manager.db.clone();
        let state = StreamState { manager: manager.clone(), db };

        let cors = CorsLayer::new().allow_origin(Any).allow_headers(Any).allow_methods(Any);
        let app = Router::new()
            .route("/stream/:torrent_id/:file_index", get(stream_file))
            .route("/hls/:torrent_id/:file_index/playlist.m3u8", get(hls_playlist))
            .layer(cors)
            .with_state(state);

        let addr = SocketAddr::from(([127, 0, 0, 1], port));
        let listener = TcpListener::bind(addr).await?;
        info!("Streaming server on {}", addr);
        tokio::spawn(async move {
            axum::serve(listener, app).await.expect("Streaming server failed");
        });
        Ok(Self { port, manager })
    }

    pub fn base_url(&self) -> String { format!("http://127.0.0.1:{}", self.port) }
    pub fn stream_url(&self, id: &str, fi: usize) -> String { format!("{}/stream/{}/{}", self.base_url(), id, fi) }
    pub fn hls_url(&self, id: &str, fi: usize) -> String { format!("{}/hls/{}/{}/playlist.m3u8", self.base_url(), id, fi) }
}

/// Serve torrent file from disk with Range support.
async fn stream_file(
    State(state): State<StreamState>,
    Path((torrent_id, file_index)): Path<(String, usize)>,
    headers: HeaderMap,
) -> Result<Response, StatusCode> {
    let handle = state.manager.get_handle(&torrent_id).await.ok_or(StatusCode::NOT_FOUND)?;

    // Get the save path from the DB record
    let save_path = state.db.get_torrent(&torrent_id).await
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?
        .ok_or(StatusCode::NOT_FOUND)?
        .save_path;

    let (file_path, mime) = {
        let fi = handle.with_metadata(|meta| {
            meta.file_infos.get(file_index).map(|fi| (
                std::path::PathBuf::from(&save_path).join(&fi.relative_filename),
                detect_mime(&fi.relative_filename.to_string_lossy()).to_string(),
            ))
        });
        match fi {
            Ok(Some(v)) => v,
            _ => return Err(StatusCode::NOT_FOUND),
        }
    };

    if !file_path.exists() { return Err(StatusCode::SERVICE_UNAVAILABLE); }

    let file_size = std::fs::metadata(&file_path).map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?.len();

    if let Some(range_header) = headers.get(header::RANGE) {
        let range_str = range_header.to_str().map_err(|_| StatusCode::BAD_REQUEST)?;
        if let Some((start, end)) = parse_range(range_str, file_size) {
            let length = end - start + 1;
            use tokio::io::{AsyncReadExt, AsyncSeekExt};
            let mut f = tokio::fs::File::open(&file_path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            f.seek(std::io::SeekFrom::Start(start)).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
            let stream = tokio_util::io::ReaderStream::new(f.take(length));
            return Ok(Response::builder()
                .status(StatusCode::PARTIAL_CONTENT)
                .header(header::CONTENT_TYPE, mime)
                .header(header::CONTENT_LENGTH, length.to_string())
                .header(header::CONTENT_RANGE, format!("bytes {}-{}/{}", start, end, file_size))
                .header(header::ACCEPT_RANGES, "bytes")
                .body(Body::from_stream(stream))
                .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?);
        }
    }

    let f = tokio::fs::File::open(&file_path).await.map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?;
    let stream = tokio_util::io::ReaderStream::new(f);
    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, mime)
        .header(header::CONTENT_LENGTH, file_size.to_string())
        .header(header::ACCEPT_RANGES, "bytes")
        .body(Body::from_stream(stream))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
}

async fn hls_playlist(
    State(state): State<StreamState>,
    Path((torrent_id, file_index)): Path<(String, usize)>,
) -> Result<Response, StatusCode> {
    let handle = state.manager.get_handle(&torrent_id).await.ok_or(StatusCode::NOT_FOUND)?;
    let file_size: u64 = handle.with_metadata(|meta| {
        meta.file_infos.get(file_index).map(|fi| fi.len)
    }).ok().flatten().ok_or(StatusCode::NOT_FOUND)?;

    let seg_size: u64 = 10 * 1024 * 1024;
    let num_segs = (file_size + seg_size - 1) / seg_size;
    let mut m3u8 = "#EXTM3U\n#EXT-X-VERSION:4\n#EXT-X-TARGETDURATION:10\n#EXT-X-PLAYLIST-TYPE:VOD\n".to_string();
    for i in 0..num_segs {
        let start = i * seg_size;
        let end = ((i + 1) * seg_size).min(file_size) - 1;
        m3u8 += &format!("#EXTINF:10.000,\nhttp://127.0.0.1:54321/stream/{}/{}?range={}-{}\n", torrent_id, file_index, start, end);
    }
    m3u8 += "#EXT-X-ENDLIST\n";

    Ok(Response::builder()
        .status(StatusCode::OK)
        .header(header::CONTENT_TYPE, "application/vnd.apple.mpegurl")
        .body(Body::from(m3u8))
        .map_err(|_| StatusCode::INTERNAL_SERVER_ERROR)?)
}

fn parse_range(range: &str, file_size: u64) -> Option<(u64, u64)> {
    let r = range.strip_prefix("bytes=")?;
    let mut parts = r.split('-');
    let start: u64 = parts.next()?.parse().ok()?;
    let end: u64 = match parts.next()? {
        "" => file_size.saturating_sub(1),
        s => s.parse::<u64>().ok()?.min(file_size.saturating_sub(1)),
    };
    if start > end || start >= file_size { return None; }
    Some((start, end))
}

fn detect_mime(filename: &str) -> &'static str {
    let l = filename.to_lowercase();
    if l.ends_with(".mp4") || l.ends_with(".m4v") { return "video/mp4"; }
    if l.ends_with(".mkv") { return "video/x-matroska"; }
    if l.ends_with(".avi") { return "video/x-msvideo"; }
    if l.ends_with(".webm") { return "video/webm"; }
    if l.ends_with(".mp3") { return "audio/mpeg"; }
    if l.ends_with(".flac") { return "audio/flac"; }
    "application/octet-stream"
}

