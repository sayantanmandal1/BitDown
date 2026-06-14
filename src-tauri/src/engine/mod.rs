use serde::{Deserialize, Serialize};

pub mod manager;
pub mod events;
pub use manager::TorrentManager;

// ─── Persistent record stored in SQLite ──────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct TorrentRecord {
    pub id: String,
    pub name: String,
    pub info_hash: String,
    pub magnet_uri: Option<String>,
    pub torrent_file_path: Option<String>,
    pub save_path: String,
    pub status: String,
    pub category: Option<String>,
    pub label: Option<String>,
    pub added_at: i64,
    pub completed_at: Option<i64>,
    pub total_size: i64,
    pub downloaded: i64,
    pub uploaded: i64,
    pub download_limit: Option<i64>,
    pub upload_limit: Option<i64>,
    pub max_peers: Option<i64>,
    pub sequential_download: i64,
    pub priority: i64,
    pub metadata_id: Option<String>,
    pub metadata_type: Option<String>,
    pub notes: Option<String>,
}

// ─── Live stats emitted via Tauri events ─────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentProgress {
    pub id: String,
    pub status: String,
    pub downloaded: u64,
    pub uploaded: u64,
    pub total_size: u64,
    pub progress: f64,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub eta_seconds: Option<u64>,
    pub num_peers: usize,
    pub num_seeders: usize,
    pub piece_availability: f64,
}

// ─── Torrent summary for list view ───────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentSummary {
    pub record: TorrentRecord,
    pub live: Option<TorrentProgress>,
    pub health_score: u8,
}

// ─── File info ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentFileInfo {
    pub index: usize,
    pub path: String,
    pub size: u64,
    pub downloaded: u64,
    pub progress: f64,
    pub priority: u8,
    pub wanted: bool,
}

// ─── Peer info ───────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PeerInfo {
    pub addr: String,
    pub country: Option<String>,
    pub client: Option<String>,
    pub download_speed: u64,
    pub upload_speed: u64,
    pub progress: f64,
    pub flags: String,
}

// ─── Tracker info ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackerInfo {
    pub url: String,
    pub status: String,
    pub peers: i64,
    pub seeds: i64,
    pub last_announce: Option<i64>,
    pub next_announce: Option<i64>,
    pub message: Option<String>,
}
