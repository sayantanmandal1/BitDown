use rand::Rng;
use serde::{Deserialize, Serialize};
use sysinfo::System;
use tauri::State;
use uuid::Uuid;

use crate::AppState;

type CmdResult<T> = Result<T, String>;
fn err(e: impl std::fmt::Display) -> String { e.to_string() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppSettings {
    pub default_download_path: String,
    pub listen_port: u16,
    pub max_active_torrents: usize,
    pub max_download_speed: i64,  // 0 = unlimited, bytes/sec
    pub max_upload_speed: i64,
    pub max_connections_global: i64,
    pub max_connections_per_torrent: i64,
    pub enable_dht: bool,
    pub enable_pex: bool,
    pub enable_lsd: bool,
    pub upnp_enabled: bool,
    pub natpmp_enabled: bool,
    pub encryption_mode: String, // "prefer", "force", "disable"
    pub tmdb_api_key: String,
    pub auto_organize_template: String,
    pub plex_url: Option<String>,
    pub jellyfin_url: Option<String>,
    pub jellyfin_api_key: Option<String>,
    pub remote_enabled: bool,
    pub remote_token: String,
    pub start_minimized: bool,
    pub minimize_to_tray: bool,
    pub auto_start: bool,
    pub completed_action: String, // "nothing", "seed", "move", "delete"
    pub seed_ratio_limit: f64,    // 0 = no limit
    pub seed_time_limit: i64,     // seconds, 0 = no limit
    pub sequential_default: bool,
    pub disk_cache_mb: i64,
    pub theme: String,
    pub notify_on_complete: bool,
    pub notify_on_rss: bool,
}

impl AppSettings {
    pub fn apply_kv(&mut self, key: &str, value: &str) {
        match key {
            "default_download_path" => self.default_download_path = value.to_string(),
            "listen_port" => self.listen_port = value.parse().unwrap_or(6881),
            "max_download_speed" => self.max_download_speed = value.parse().unwrap_or(0),
            "max_upload_speed" => self.max_upload_speed = value.parse().unwrap_or(0),
            "max_connections_global" => self.max_connections_global = value.parse().unwrap_or(500),
            "max_connections_per_torrent" => self.max_connections_per_torrent = value.parse().unwrap_or(250),
            "enable_dht" => self.enable_dht = value == "1",
            "enable_pex" => self.enable_pex = value == "1",
            "enable_lsd" => self.enable_lsd = value == "1",
            "upnp_enabled" => self.upnp_enabled = value == "1",
            "natpmp_enabled" => self.natpmp_enabled = value == "1",
            "encryption_mode" => self.encryption_mode = value.to_string(),
            "tmdb_api_key" => self.tmdb_api_key = value.to_string(),
            "auto_organize_template" => self.auto_organize_template = value.to_string(),
            "plex_url" => self.plex_url = if value.is_empty() { None } else { Some(value.to_string()) },
            "jellyfin_url" => self.jellyfin_url = if value.is_empty() { None } else { Some(value.to_string()) },
            "jellyfin_api_key" => self.jellyfin_api_key = if value.is_empty() { None } else { Some(value.to_string()) },
            "remote_enabled" => self.remote_enabled = value == "1",
            "remote_token" => self.remote_token = value.to_string(),
            "start_minimized" => self.start_minimized = value == "1",
            "minimize_to_tray" => self.minimize_to_tray = value == "1",
            "auto_start" => self.auto_start = value == "1",
            "completed_action" => self.completed_action = value.to_string(),
            "seed_ratio_limit" => self.seed_ratio_limit = value.parse().unwrap_or(0.0),
            "seed_time_limit" => self.seed_time_limit = value.parse().unwrap_or(0),
            "disk_cache_mb" => self.disk_cache_mb = value.parse().unwrap_or(256),
            "theme" => self.theme = value.to_string(),
            "notify_on_complete" => self.notify_on_complete = value == "1",
            "notify_on_rss" => self.notify_on_rss = value == "1",
            _ => {}
        }
    }
}

impl Default for AppSettings {
    fn default() -> Self {
        let download_path = dirs::download_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."))
            .to_string_lossy()
            .to_string();

        Self {
            default_download_path: download_path,
            listen_port: 6881,
            max_active_torrents: 0,
            max_download_speed: 0,
            max_upload_speed: 0,
            max_connections_global: 500,
            max_connections_per_torrent: 250,
            enable_dht: true,
            enable_pex: true,
            enable_lsd: true,
            upnp_enabled: true,
            natpmp_enabled: true,
            encryption_mode: "prefer".to_string(),
            // SECURITY_NOTE: key is read from TMDB_API_KEY env var at compile time.
            // Set it in .env (local) or as a GitHub Secret (CI). Never hardcode here.
            tmdb_api_key: option_env!("TMDB_API_KEY").unwrap_or("").to_string(),
            auto_organize_template: "{title} ({year})".to_string(),
            plex_url: None,
            jellyfin_url: None,
            jellyfin_api_key: None,
            remote_enabled: false,
            remote_token: Uuid::new_v4().to_string(),
            start_minimized: false,
            minimize_to_tray: true,
            auto_start: false,
            completed_action: "seed".to_string(),
            seed_ratio_limit: 2.0,
            seed_time_limit: 0,
            sequential_default: false,
            disk_cache_mb: 256,
            theme: "dark".to_string(),
            notify_on_complete: true,
            notify_on_rss: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WebhookConfig {
    pub id: String,
    pub name: String,
    pub url: String,
    pub events: Vec<String>, // "complete", "added", "error", "rss_match"
    pub enabled: bool,
}

#[derive(Debug, Serialize)]
pub struct GlobalStats {
    pub download_speed: u64,
    pub upload_speed: u64,
    pub num_downloading: usize,
    pub num_seeding: usize,
    pub num_paused: usize,
    pub num_checking: usize,
    pub num_error: usize,
    pub session_downloaded: u64,
    pub session_uploaded: u64,
    pub all_time_downloaded: u64,
    pub all_time_uploaded: u64,
    pub dht_nodes: u32,
    pub free_disk_bytes: u64,
    pub listen_port: u16,
    pub version: String,
}

#[tauri::command]
pub async fn get_settings(state: State<'_, AppState>) -> CmdResult<AppSettings> {
    let s = state.manager.settings.read().await;
    Ok(s.clone())
}

#[tauri::command]
pub async fn save_settings(
    state: State<'_, AppState>,
    settings: AppSettings,
) -> CmdResult<()> {
    // Persist each field
    macro_rules! save {
        ($key:literal, $val:expr) => {
            state.db.save_setting($key, &$val.to_string()).await.map_err(err)?;
        };
    }
    save!("default_download_path", settings.default_download_path);
    save!("listen_port", settings.listen_port);
    save!("max_download_speed", settings.max_download_speed);
    save!("max_upload_speed", settings.max_upload_speed);
    save!("max_connections_global", settings.max_connections_global);
    save!("max_connections_per_torrent", settings.max_connections_per_torrent);
    save!("enable_dht", if settings.enable_dht { "1" } else { "0" });
    save!("enable_pex", if settings.enable_pex { "1" } else { "0" });
    save!("upnp_enabled", if settings.upnp_enabled { "1" } else { "0" });
    save!("encryption_mode", settings.encryption_mode);
    save!("tmdb_api_key", settings.tmdb_api_key);
    save!("auto_organize_template", settings.auto_organize_template);
    save!("plex_url", settings.plex_url.clone().unwrap_or_default());
    save!("jellyfin_url", settings.jellyfin_url.clone().unwrap_or_default());
    save!("jellyfin_api_key", settings.jellyfin_api_key.clone().unwrap_or_default());
    save!("remote_enabled", if settings.remote_enabled { "1" } else { "0" });
    save!("remote_token", settings.remote_token);
    save!("minimize_to_tray", if settings.minimize_to_tray { "1" } else { "0" });
    save!("notify_on_complete", if settings.notify_on_complete { "1" } else { "0" });
    save!("seed_ratio_limit", settings.seed_ratio_limit);
    save!("disk_cache_mb", settings.disk_cache_mb);

    let mut s = state.manager.settings.write().await;
    *s = settings;
    Ok(())
}

#[tauri::command]
pub async fn get_global_stats(state: State<'_, AppState>) -> CmdResult<GlobalStats> {
    let summaries = state.manager.get_all_summaries().await;

    let mut dl_speed = 0u64;
    let mut ul_speed = 0u64;
    let mut num_downloading = 0;
    let mut num_seeding = 0;
    let mut num_paused = 0;
    let mut num_checking = 0;
    let mut num_error = 0;

    for s in &summaries {
        match s.record.status.as_str() {
            "downloading" => { num_downloading += 1; }
            "seeding" => { num_seeding += 1; }
            "paused" => { num_paused += 1; }
            "checking" => { num_checking += 1; }
            "error" => { num_error += 1; }
            _ => {}
        }
        if let Some(live) = &s.live {
            dl_speed += live.download_speed;
            ul_speed += live.upload_speed;
        }
    }

    // Free disk space
    let settings = state.manager.settings.read().await;
    let download_path = settings.default_download_path.clone();
    let listen_port = settings.listen_port;
    drop(settings);

    let free_disk = get_free_space(&download_path);

    Ok(GlobalStats {
        download_speed: dl_speed,
        upload_speed: ul_speed,
        num_downloading,
        num_seeding,
        num_paused,
        num_checking,
        num_error,
        session_downloaded: dl_speed * 1, // TODO: accumulate
        session_uploaded: 0,
        all_time_downloaded: 0,
        all_time_uploaded: 0,
        dht_nodes: 0,
        free_disk_bytes: free_disk,
        listen_port,
        version: env!("CARGO_PKG_VERSION").to_string(),
    })
}

#[tauri::command]
pub async fn get_system_info() -> CmdResult<serde_json::Value> {
    let mut sys = System::new_all();
    sys.refresh_all();

    Ok(serde_json::json!({
        "total_memory": sys.total_memory(),
        "used_memory": sys.used_memory(),
        "cpu_count": sys.cpus().len(),
        "os": System::name(),
        "kernel": System::kernel_version(),
    }))
}

#[tauri::command]
pub async fn generate_remote_token(state: State<'_, AppState>) -> CmdResult<String> {
    let token: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    state.db.save_setting("remote_token", &token).await.map_err(err)?;
    let mut s = state.manager.settings.write().await;
    s.remote_token = token.clone();
    Ok(token)
}

#[tauri::command]
pub async fn get_remote_qr(state: State<'_, AppState>) -> CmdResult<String> {
    let settings = state.manager.settings.read().await;
    let token = settings.remote_token.clone();
    drop(settings);

    // Get local IP (simple approach)
    let ip = local_ip();
    let url = format!("ws://{}:54322/ws?token={}", ip, token);

    use qrcode::{QrCode, render::svg};
    let code = QrCode::new(&url).map_err(err)?;
    let svg = code.render::<svg::Color<'_>>().build();
    Ok(svg)
}

#[tauri::command]
pub async fn test_webhook(url: String) -> CmdResult<bool> {
    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(10))
        .build()
        .map_err(err)?;

    let resp = client.post(&url)
        .json(&serde_json::json!({
            "event": "test",
            "message": "BitDown webhook test",
            "timestamp": chrono::Utc::now().timestamp(),
        }))
        .send()
        .await
        .map_err(err)?;

    Ok(resp.status().is_success())
}

#[tauri::command]
pub async fn add_webhook(
    state: State<'_, AppState>,
    name: String,
    url: String,
    events: Vec<String>,
) -> CmdResult<WebhookConfig> {
    let wh = WebhookConfig {
        id: Uuid::new_v4().to_string(),
        name,
        url,
        events,
        enabled: true,
    };
    state.db.insert_webhook(&wh).await.map_err(err)?;
    Ok(wh)
}

#[tauri::command]
pub async fn remove_webhook(state: State<'_, AppState>, id: String) -> CmdResult<()> {
    state.db.delete_webhook(&id).await.map_err(err)
}

fn get_free_space(path: &str) -> u64 {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::ffi::OsStrExt;
        let wide: Vec<u16> = std::ffi::OsStr::new(path)
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let mut free: u64 = 0;
        let mut total: u64 = 0;
        let mut total_free: u64 = 0;
        unsafe {
            windows_sys::Win32::Storage::FileSystem::GetDiskFreeSpaceExW(
                wide.as_ptr(),
                &mut free as *mut u64,
                &mut total as *mut u64,
                &mut total_free as *mut u64,
            );
        }
        free
    }
    #[cfg(not(target_os = "windows"))]
    {
        0
    }
}

fn local_ip() -> String {
    // Try UDP connect trick
    if let Ok(socket) = std::net::UdpSocket::bind("0.0.0.0:0") {
        if socket.connect("8.8.8.8:80").is_ok() {
            if let Ok(addr) = socket.local_addr() {
                return addr.ip().to_string();
            }
        }
    }
    "127.0.0.1".to_string()
}
