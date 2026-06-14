// Events module — re-exports for the event bridge.
// The main event emission loop lives in manager.rs (start_event_loop).
// This module provides additional event type definitions.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalStats {
    pub download_speed: u64,
    pub upload_speed: u64,
    pub num_active: usize,
    pub num_downloading: usize,
    pub num_seeding: usize,
    pub dht_nodes: usize,
    pub free_disk_bytes: u64,
    pub listen_port: u16,
    pub session_downloaded: u64,
    pub session_uploaded: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TorrentCompleted {
    pub id: String,
    pub name: String,
    pub save_path: String,
    pub total_size: u64,
}
