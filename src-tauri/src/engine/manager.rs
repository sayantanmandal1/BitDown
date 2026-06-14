use anyhow::{Context, Result};
use librqbit::{
    AddTorrent, AddTorrentOptions, AddTorrentResponse, ManagedTorrent, Session,
    SessionOptions,
};
use std::{collections::HashMap, path::PathBuf, sync::Arc, time::Duration};
use tauri::{AppHandle, Emitter};
use tokio::sync::RwLock;
use tracing::{error, warn};

use super::{TorrentRecord, TorrentProgress, TorrentSummary, TorrentFileInfo};
use crate::{commands::settings::AppSettings, db::Database};

pub struct TorrentManager {
    pub session: Arc<Session>,
    pub db: Arc<Database>,
    pub app: AppHandle,
    pub handle_map: Arc<RwLock<HashMap<String, Arc<ManagedTorrent>>>>,
    pub settings: Arc<RwLock<AppSettings>>,
}

impl TorrentManager {
    pub async fn new(app: AppHandle, db: Arc<Database>, settings: AppSettings) -> Result<Self> {
        let save_path = settings.default_download_path.clone();
        std::fs::create_dir_all(&save_path).ok();

        let session_opts = SessionOptions {
            listen_port_range: Some(settings.listen_port..settings.listen_port + 100),
            enable_upnp_port_forwarding: settings.upnp_enabled,
            ..Default::default()
        };

        let session = Session::new_with_opts(PathBuf::from(&save_path), session_opts)
            .await
            .context("Failed to create librqbit session")?;

        let mgr = Self {
            session,
            db,
            app: app.clone(),
            handle_map: Arc::new(RwLock::new(HashMap::new())),
            settings: Arc::new(RwLock::new(settings)),
        };

        mgr.start_event_loop(app);
        Ok(mgr)
    }

    pub async fn restore_from_db(&self) {
        let records = match self.db.get_all_torrents().await {
            Ok(r) => r,
            Err(e) => { error!("Failed to load torrents: {}", e); return; }
        };
        for rec in records {
            if rec.status == "error" { continue; }
            let paused = rec.status == "paused";
            if let Err(e) = self.add_internal(&rec.id, &rec.save_path,
                rec.magnet_uri.as_deref(), rec.torrent_file_path.as_deref(), paused).await {
                warn!("Failed to restore {}: {}", rec.name, e);
            }
        }
    }

    pub async fn add_from_file(&self, uuid: &str, torrent_path: &str, save_path: &str, paused: bool) -> Result<TorrentRecord> {
        let contents = std::fs::read(torrent_path).context("Cannot read .torrent file")?;
        let meta: librqbit::TorrentMetaV1Owned = librqbit::torrent_from_bytes(&contents)?;
        let name = meta.info.name.as_ref()
            .and_then(|n| std::str::from_utf8(n.0.as_ref()).ok())
            .unwrap_or(uuid).to_string();
        // info_hash as lowercase hex
        let info_hash = meta.info_hash.0.iter().map(|b| format!("{:02x}", b)).collect::<String>();
        // Total size will be updated once the torrent initializes
        let total_size = 0i64;

        let record = make_record(uuid, &name, &info_hash, None, Some(torrent_path), save_path, total_size, paused);
        self.db.insert_torrent(&record).await?;
        self.add_internal(uuid, save_path, None, Some(torrent_path), paused).await?;
        Ok(record)
    }

    pub async fn add_from_magnet(&self, uuid: &str, magnet: &str, save_path: &str, paused: bool) -> Result<TorrentRecord> {
        let name = magnet_display_name(magnet);
        let info_hash = magnet_info_hash(magnet).unwrap_or_default();
        let record = make_record(uuid, &name, &info_hash, Some(magnet), None, save_path, 0, paused);
        self.db.insert_torrent(&record).await?;
        self.add_internal(uuid, save_path, Some(magnet), None, paused).await?;
        Ok(record)
    }

    async fn add_internal(&self, uuid: &str, save_path: &str, magnet: Option<&str>, file_path: Option<&str>, paused: bool) -> Result<()> {
        let add = if let Some(m) = magnet {
            AddTorrent::from_url(m)
        } else if let Some(f) = file_path {
            AddTorrent::from_bytes(std::fs::read(f)?)
        } else {
            return Err(anyhow::anyhow!("No source"));
        };

        let opts = AddTorrentOptions {
            paused: paused,
            output_folder: Some(save_path.to_string()),
            ..Default::default()
        };

        let response = self.session.add_torrent(add, Some(opts)).await?;
        let handle = match response {
            AddTorrentResponse::AlreadyManaged(_, h) => h,
            AddTorrentResponse::Added(_, h) => h,
            AddTorrentResponse::ListOnly(_) => return Err(anyhow::anyhow!("Torrent added in list-only mode")),
        };

        let uuid_str = uuid.to_string();
        let db = self.db.clone();
        let h = handle.clone();
        tokio::spawn(async move {
            if h.wait_until_initialized().await.is_ok() {
                if let Some(name) = h.name() {
                    let size = h.stats().total_bytes as i64;
                    let _ = sqlx::query("UPDATE torrents SET name = ?, total_size = ? WHERE id = ?")
                        .bind(&name).bind(size).bind(&uuid_str)
                        .execute(db.pool()).await;
                }
            }
        });

        self.handle_map.write().await.insert(uuid.to_string(), handle);
        Ok(())
    }

    pub async fn remove_torrent(&self, uuid: &str, delete_files: bool) -> Result<()> {
        if let Some(h) = self.handle_map.write().await.remove(uuid) {
            // Use session.get() to delete by id
            self.session.delete(librqbit::api::TorrentIdOrHash::Id(h.id()), delete_files).await.ok();
        }
        self.db.delete_torrent(uuid).await?;
        Ok(())
    }

    pub async fn pause_torrent(&self, uuid: &str) -> Result<()> {
        if let Some(h) = self.get_handle(uuid).await { self.session.pause(&h).await?; }
        Ok(())
    }

    pub async fn resume_torrent(&self, uuid: &str) -> Result<()> {
        if let Some(h) = self.get_handle(uuid).await { self.session.unpause(&h).await?; }
        Ok(())
    }

    pub async fn force_recheck(&self, uuid: &str) -> Result<()> {
        if let Some(rec) = self.db.get_torrent(uuid).await? {
            if let Some(h) = self.handle_map.write().await.remove(uuid) {
                self.session.delete(librqbit::api::TorrentIdOrHash::Id(h.id()), false).await.ok();
            }
            self.add_internal(uuid, &rec.save_path, rec.magnet_uri.as_deref(), rec.torrent_file_path.as_deref(), false).await?;
        }
        Ok(())
    }

    pub async fn get_handle(&self, uuid: &str) -> Option<Arc<ManagedTorrent>> {
        self.handle_map.read().await.get(uuid).cloned()
    }

    pub async fn get_lt_id(&self, uuid: &str) -> Option<usize> {
        self.handle_map.read().await.get(uuid).map(|h| h.id())
    }

    pub async fn get_all_summaries(&self) -> Vec<TorrentSummary> {
        let records = self.db.get_all_torrents().await.unwrap_or_default();
        let mut out = Vec::new();
        for rec in records {
            let live = self.build_progress(&rec).await;
            let health = compute_health_score(&live);
            out.push(TorrentSummary { record: rec, live, health_score: health });
        }
        out
    }

    async fn build_progress(&self, rec: &TorrentRecord) -> Option<TorrentProgress> {
        let h = self.get_handle(&rec.id).await?;
        let s = h.stats();
        let total = s.total_bytes;
        let dl = s.progress_bytes;
        let ul = s.uploaded_bytes;
        let progress = if total > 0 { dl as f64 / total as f64 } else { 0.0 };

        let (ds, us, peers, seeds) = if let Some(live) = &s.live {
            // Speed.mbps is MiB/s; convert to bytes/sec: MiB/s * 1024*1024 / 8 would be Mb/s
            // librqbit Speed.mbps is actually MiB/s (binary megabytes)
            let ds = (live.download_speed.mbps * 131_072.0) as u64; // 1 MiB/s = 131072 B/s
            let us = (live.upload_speed.mbps * 131_072.0) as u64;
            (ds, us, live.snapshot.peer_stats.live, live.snapshot.peer_stats.seen)
        } else { (0, 0, 0, 0) };

        let eta = if ds > 0 && dl < total { Some((total - dl) / ds) } else { None };
        let status = torrent_status(&h, &s);

        Some(TorrentProgress {
            id: rec.id.clone(), status: status.to_string(),
            downloaded: dl, uploaded: ul, total_size: total, progress,
            download_speed: ds, upload_speed: us, eta_seconds: eta,
            num_peers: peers, num_seeders: seeds, piece_availability: 1.0,
        })
    }

    pub async fn get_files(&self, uuid: &str) -> Vec<TorrentFileInfo> {
        let h = match self.get_handle(uuid).await { Some(h) => h, None => return vec![] };
        let fp = h.stats().file_progress.clone();
        h.with_metadata(|meta| {
            meta.file_infos.iter().enumerate().map(|(i, fi)| {
                let path = fi.relative_filename.to_string_lossy().to_string();
                let length = fi.len;
                let done = fp.get(i).copied().unwrap_or(0);
                TorrentFileInfo {
                    index: i, path, size: length, downloaded: done,
                    progress: if length > 0 { done as f64 / length as f64 } else { 0.0 },
                    priority: 4, wanted: true,
                }
            }).collect()
        }).unwrap_or_default()
    }

    pub async fn get_piece_map(&self, uuid: &str) -> Option<Vec<u8>> {
        let h = self.get_handle(uuid).await?;
        let s = h.stats();
        let total = s.total_bytes;
        let progress = s.progress_bytes;
        let pieces = ((total / (256 * 1024)).max(1)).min(4096) as usize;
        let done = if total > 0 { (progress * pieces as u64 / total) as usize } else { 0 };
        let mut map = vec![0u8; pieces];
        for i in 0..done.min(pieces) { map[i] = 1; }
        Some(map)
    }

    fn start_event_loop(&self, app: AppHandle) {
        let handle_map = self.handle_map.clone();
        let db = self.db.clone();
        tokio::spawn(async move {
            let mut ticker = tokio::time::interval(Duration::from_secs(1));
            loop {
                ticker.tick().await;
                let handles: Vec<(String, Arc<ManagedTorrent>)> = {
                    let m = handle_map.read().await;
                    m.iter().map(|(k, v)| (k.clone(), v.clone())).collect()
                };
                let mut gd = 0u64; let mut gu = 0u64;
                let mut all: Vec<TorrentProgress> = Vec::new();

                for (uuid, h) in &handles {
                    let s = h.stats();
                    let total = s.total_bytes;
                    let dl = s.progress_bytes;
                    let ul = s.uploaded_bytes;
                    let pct = if total > 0 { dl as f64 / total as f64 } else { 0.0 };
                    let (ds, us, peers, seeds) = if let Some(live) = &s.live {
                        let ds = (live.download_speed.mbps * 131_072.0) as u64;
                        let us = (live.upload_speed.mbps * 131_072.0) as u64;
                        (ds, us, live.snapshot.peer_stats.live, live.snapshot.peer_stats.seen)
                    } else { (0, 0, 0, 0) };
                    gd += ds; gu += us;
                    let status = torrent_status(h, &s);
                    let eta = if ds > 0 && dl < total { Some((total - dl) / ds) } else { None };
                    all.push(TorrentProgress {
                        id: uuid.clone(), status: status.to_string(),
                        downloaded: dl, uploaded: ul, total_size: total, progress: pct,
                        download_speed: ds, upload_speed: us, eta_seconds: eta,
                        num_peers: peers, num_seeders: seeds, piece_availability: 1.0,
                    });
                    let ts = chrono::Utc::now().timestamp();
                    if ts % 5 == 0 {
                        let _ = db.update_torrent_progress(uuid, dl as i64, ul as i64, status).await;
                        let _ = db.record_speed(Some(uuid), ds as i64, us as i64).await;
                    }
                }
                if chrono::Utc::now().timestamp() % 5 == 0 {
                    let _ = db.record_speed(None, gd as i64, gu as i64).await;
                }
                let _ = app.emit("torrent:progress", &all);
                let _ = app.emit("stats:global", serde_json::json!({
                    "download_speed": gd, "upload_speed": gu, "dht_nodes": 0u32
                }));
            }
        });
    }
}

fn torrent_status(h: &ManagedTorrent, s: &librqbit::TorrentStats) -> &'static str {
    if h.is_paused() { "paused" }
    else if s.finished { "seeding" }
    else if s.error.is_some() { "error" }
    else if s.progress_bytes == 0 { "checking" }
    else { "downloading" }
}

fn compute_health_score(live: &Option<TorrentProgress>) -> u8 {
    let Some(p) = live else { return 0 };
    if p.num_seeders == 0 { return 10; }
    (p.num_seeders as f64 / p.num_peers.max(1) as f64 * 100.0).min(100.0) as u8
}

fn make_record(
    uuid: &str, name: &str, info_hash: &str,
    magnet: Option<&str>, file_path: Option<&str>,
    save_path: &str, total_size: i64, paused: bool,
) -> TorrentRecord {
    TorrentRecord {
        id: uuid.to_string(), name: name.to_string(), info_hash: info_hash.to_string(),
        magnet_uri: magnet.map(|s| s.to_string()),
        torrent_file_path: file_path.map(|s| s.to_string()),
        save_path: save_path.to_string(),
        status: if paused { "paused".into() } else { "downloading".into() },
        category: None, label: None, added_at: chrono::Utc::now().timestamp(),
        completed_at: None, total_size, downloaded: 0, uploaded: 0,
        download_limit: None, upload_limit: None, max_peers: None,
        sequential_download: 0, priority: 5,
        metadata_id: None, metadata_type: None, notes: None,
    }
}

fn magnet_display_name(magnet: &str) -> String {
    if let Some(start) = magnet.find("dn=") {
        let rest = &magnet[start + 3..];
        let end = rest.find('&').unwrap_or(rest.len());
        urlencoding::decode(&rest[..end]).map(|s| s.to_string()).unwrap_or_else(|_| rest[..end].to_string())
    } else if let Some(start) = magnet.find("btih:") {
        let rest = &magnet[start + 5..];
        format!("Magnet:{}", &rest[..rest.find('&').unwrap_or(rest.len().min(40))])
    } else { "Unknown torrent".to_string() }
}

fn magnet_info_hash(magnet: &str) -> Option<String> {
    if let Some(start) = magnet.find("btih:") {
        let rest = &magnet[start + 5..];
        let end = rest.find('&').unwrap_or(rest.len().min(40));
        Some(rest[..end].to_uppercase())
    } else { None }
}
