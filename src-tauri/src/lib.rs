use tauri::Manager;
use std::sync::Arc;

mod db;
mod engine;
mod streaming;
mod intelligence;
mod privacy;
mod rss;
mod sync;
mod commands;

use engine::TorrentManager;
use db::Database;
use streaming::StreamingServer;
use sync::RemoteServer;

pub struct AppState {
    pub manager: Arc<TorrentManager>,
    pub db: Arc<Database>,
    pub streaming: Arc<StreamingServer>,
    pub remote: Arc<RemoteServer>,
    pub app_handle: tauri::AppHandle,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "bitdown=debug,librqbit=info".into()),
        )
        .init();

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            tauri::async_runtime::block_on(async move {
                // Init database
                let db = Arc::new(
                    Database::new(&app_handle)
                        .await
                        .expect("Failed to initialize database"),
                );

                // Load settings from DB
                let settings = db.load_settings().await.unwrap_or_default();

                // Init torrent engine
                let manager = Arc::new(
                    TorrentManager::new(app_handle.clone(), db.clone(), settings.clone())
                        .await
                        .expect("Failed to initialize torrent engine"),
                );

                // Restore torrents from previous session
                manager.restore_from_db().await;

                // Init streaming server
                let streaming = Arc::new(
                    StreamingServer::new(manager.clone())
                        .await
                        .expect("Failed to start streaming server"),
                );

                // Init remote control server
                let remote = Arc::new(
                    RemoteServer::new(manager.clone(), settings.remote_token.clone())
                        .await
                        .expect("Failed to start remote server"),
                );

                let state = AppState { manager, db, streaming, remote, app_handle: app_handle.clone() };
                app_handle.manage(state);
            });

            // Set up system tray
            #[cfg(target_os = "windows")]
            {
                use tauri::tray::TrayIconBuilder;
                use tauri::menu::{MenuBuilder, MenuItem};
                let show_item = MenuItem::with_id(app, "show", "Show BitDown", true, None::<&str>)?;
                let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let menu = MenuBuilder::new(app).items(&[&show_item, &quit_item]).build()?;
                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => { let _ = app.get_webview_window("main").map(|w| w.show()); }
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Torrent commands
            commands::torrent::add_torrent_file,
            commands::torrent::add_torrent_magnet,
            commands::torrent::remove_torrent,
            commands::torrent::pause_torrent,
            commands::torrent::resume_torrent,
            commands::torrent::get_all_torrents,
            commands::torrent::get_torrent_details,
            commands::torrent::get_torrent_files,
            commands::torrent::get_torrent_peers,
            commands::torrent::get_torrent_trackers,
            commands::torrent::set_file_priority,
            commands::torrent::set_torrent_priority,
            commands::torrent::force_recheck,
            commands::torrent::open_download_folder,
            commands::torrent::create_torrent,
            commands::torrent::get_torrent_piece_map,
            commands::torrent::get_speed_history,
            commands::torrent::set_torrent_label,
            commands::torrent::set_download_limit,
            commands::torrent::set_upload_limit,
            commands::torrent::set_max_peers,
            commands::torrent::add_tracker,
            commands::torrent::remove_tracker,
            // Streaming commands
            commands::streaming::start_stream,
            commands::streaming::stop_stream,
            commands::streaming::get_stream_url,
            // Metadata / Intelligence commands
            commands::metadata::fetch_metadata,
            commands::metadata::search_tmdb,
            commands::metadata::get_cached_metadata,
            commands::metadata::auto_organize,
            commands::metadata::preview_organize,
            // Privacy commands
            commands::privacy::set_proxy_config,
            commands::privacy::get_proxy_config,
            commands::privacy::test_proxy,
            commands::privacy::load_blocklist,
            commands::privacy::get_blocklist_stats,
            commands::privacy::set_killswitch,
            commands::privacy::test_ip_leak,
            // RSS commands
            commands::rss::add_feed,
            commands::rss::remove_feed,
            commands::rss::get_feeds,
            commands::rss::refresh_feed,
            commands::rss::add_filter_rule,
            commands::rss::remove_filter_rule,
            commands::rss::get_filter_rules,
            // Settings commands
            commands::settings::get_settings,
            commands::settings::save_settings,
            commands::settings::get_global_stats,
            commands::settings::get_system_info,
            commands::settings::generate_remote_token,
            commands::settings::get_remote_qr,
            // Webhook commands
            commands::settings::test_webhook,
            commands::settings::add_webhook,
            commands::settings::remove_webhook,
        ])
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running bitdown");
}
