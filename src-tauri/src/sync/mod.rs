use anyhow::Result;
use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    response::Response,
    routing::get,
    Router,
};
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::{net::SocketAddr, sync::Arc};
use tokio::net::TcpListener;
use tower_http::cors::{Any, CorsLayer};
use tracing::info;

use crate::engine::TorrentManager;

pub struct RemoteServer {
    pub port: u16,
    pub token: String,
}

#[derive(Clone)]
struct WsState {
    manager: Arc<TorrentManager>,
    token: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct WsCommand {
    cmd: String,
    id: Option<String>,
    data: Option<serde_json::Value>,
    token: Option<String>,
}

#[derive(Debug, Serialize)]
struct WsResponse {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

impl RemoteServer {
    pub async fn new(manager: Arc<TorrentManager>, token: String) -> Result<Self> {
        let port = 54322u16;
        let state = WsState {
            manager,
            token: token.clone(),
        };

        let cors = CorsLayer::new()
            .allow_origin(Any)
            .allow_headers(Any)
            .allow_methods(Any);

        let app = Router::new()
            .route("/ws", get(ws_handler))
            .route("/health", get(|| async { "BitDown Remote Control" }))
            .layer(cors)
            .with_state(state);

        let addr = SocketAddr::from(([0, 0, 0, 0], port));
        let listener = TcpListener::bind(addr).await?;
        info!("Remote control WebSocket listening on {}", addr);

        tokio::spawn(async move {
            axum::serve(listener, app).await.expect("Remote server failed");
        });

        Ok(Self { port, token })
    }
}

async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<WsState>,
) -> Response {
    ws.on_upgrade(move |socket| handle_ws(socket, state))
}

async fn handle_ws(socket: WebSocket, state: WsState) {
    let (mut sender, mut receiver) = socket.split();

    while let Some(Ok(msg)) = receiver.next().await {
        if let Message::Text(text) = msg {
            let response = process_ws_command(&text, &state).await;
            let json = serde_json::to_string(&response).unwrap_or_default();
            let _ = sender.send(Message::Text(json.into())).await;
        }
    }
}

async fn process_ws_command(text: &str, state: &WsState) -> WsResponse {
    let cmd: WsCommand = match serde_json::from_str(text) {
        Ok(c) => c,
        Err(e) => return WsResponse { success: false, data: None, error: Some(e.to_string()) },
    };

    // Auth check
    if cmd.token.as_deref() != Some(&state.token) && !state.token.is_empty() {
        return WsResponse {
            success: false,
            data: None,
            error: Some("Unauthorized".to_string()),
        };
    }

    match cmd.cmd.as_str() {
        "list" => {
            let summaries = state.manager.get_all_summaries().await;
            WsResponse {
                success: true,
                data: serde_json::to_value(&summaries).ok(),
                error: None,
            }
        }
        "pause" => {
            let id = cmd.id.unwrap_or_default();
            let result = state.manager.pause_torrent(&id).await;
            to_ws_response(result)
        }
        "resume" => {
            let id = cmd.id.unwrap_or_default();
            let result = state.manager.resume_torrent(&id).await;
            to_ws_response(result)
        }
        "remove" => {
            let id = cmd.id.unwrap_or_default();
            let result = state.manager.remove_torrent(&id, false).await;
            to_ws_response(result)
        }
        "add_magnet" => {
            if let Some(data) = cmd.data {
                let magnet = data["magnet"].as_str().unwrap_or("").to_string();
                let save_path = data["save_path"].as_str().unwrap_or("").to_string();
                let uuid = uuid::Uuid::new_v4().to_string();
                let result = state.manager.add_from_magnet(&uuid, &magnet, &save_path, false).await;
                to_ws_response(result.map(|r| serde_json::to_value(&r).unwrap_or_default()))
            } else {
                WsResponse { success: false, data: None, error: Some("Missing data".to_string()) }
            }
        }
        "stats" => {
            let summaries = state.manager.get_all_summaries().await;
            let total_down: u64 = summaries.iter()
                .filter_map(|s| s.live.as_ref())
                .map(|l| l.download_speed)
                .sum();
            WsResponse {
                success: true,
                data: Some(serde_json::json!({
                    "total_download_speed": total_down,
                    "torrent_count": summaries.len(),
                })),
                error: None,
            }
        }
        _ => WsResponse {
            success: false,
            data: None,
            error: Some(format!("Unknown command: {}", cmd.cmd)),
        },
    }
}

fn to_ws_response<T: serde::Serialize>(result: anyhow::Result<T>) -> WsResponse {
    match result {
        Ok(v) => WsResponse {
            success: true,
            data: serde_json::to_value(&v).ok(),
            error: None,
        },
        Err(e) => WsResponse {
            success: false,
            data: None,
            error: Some(e.to_string()),
        },
    }
}
