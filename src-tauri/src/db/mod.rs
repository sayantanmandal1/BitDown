use anyhow::{Context, Result};
use sqlx::{sqlite::SqlitePoolOptions, Row, SqlitePool};
use tauri::Manager;

use crate::commands::settings::AppSettings;

pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(app: &tauri::AppHandle) -> Result<Self> {
        let data_dir = app.path().app_data_dir().context("Failed to get app data dir")?;
        std::fs::create_dir_all(&data_dir)?;

        let db_path = data_dir.join("bitdown.db");
        let db_url = format!("sqlite:{}?mode=rwc", db_path.display());

        let pool = SqlitePoolOptions::new()
            .max_connections(10)
            .connect(&db_url)
            .await
            .context("Failed to connect to SQLite")?;

        sqlx::query(include_str!("schema.sql"))
            .execute(&pool)
            .await
            .context("Failed to run schema")?;

        Ok(Self { pool })
    }

    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }

    pub async fn load_settings(&self) -> Result<AppSettings> {
        let rows = sqlx::query("SELECT key, value FROM settings")
            .fetch_all(&self.pool)
            .await?;
        let mut settings = AppSettings::default();
        for row in rows {
            let key: String = row.get("key");
            let value: String = row.get("value");
            settings.apply_kv(&key, &value);
        }
        Ok(settings)
    }

    pub async fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        sqlx::query("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)")
            .bind(key)
            .bind(value)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn record_speed(&self, torrent_id: Option<&str>, down: i64, up: i64) -> Result<()> {
        let now = chrono::Utc::now().timestamp();
        sqlx::query("INSERT INTO speed_history (torrent_id, timestamp, download_speed, upload_speed) VALUES (?, ?, ?, ?)")
            .bind(torrent_id)
            .bind(now)
            .bind(down)
            .bind(up)
            .execute(&self.pool)
            .await?;
        // Keep only last 24h
        sqlx::query("DELETE FROM speed_history WHERE timestamp < ? AND torrent_id IS ?")
            .bind(now - 86400)
            .bind(torrent_id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn get_speed_history(&self, torrent_id: Option<&str>, since_seconds: i64) -> Result<Vec<SpeedSample>> {
        let since = chrono::Utc::now().timestamp() - since_seconds;
        let rows = if let Some(tid) = torrent_id {
            sqlx::query("SELECT timestamp, download_speed, upload_speed FROM speed_history WHERE torrent_id = ? AND timestamp >= ? ORDER BY timestamp ASC")
                .bind(tid)
                .bind(since)
                .fetch_all(&self.pool)
                .await?
        } else {
            sqlx::query("SELECT timestamp, download_speed, upload_speed FROM speed_history WHERE torrent_id IS NULL AND timestamp >= ? ORDER BY timestamp ASC")
                .bind(since)
                .fetch_all(&self.pool)
                .await?
        };
        Ok(rows.into_iter().map(|r| SpeedSample {
            timestamp: r.get("timestamp"),
            download_speed: r.get("download_speed"),
            upload_speed: r.get("upload_speed"),
        }).collect())
    }

    pub async fn update_torrent_progress(&self, id: &str, downloaded: i64, uploaded: i64, status: &str) -> Result<()> {
        sqlx::query("UPDATE torrents SET downloaded = ?, uploaded = ?, status = ? WHERE id = ?")
            .bind(downloaded)
            .bind(uploaded)
            .bind(status)
            .bind(id)
            .execute(&self.pool)
            .await?;
        Ok(())
    }
}

#[derive(serde::Serialize, serde::Deserialize, Clone, Debug)]
pub struct SpeedSample {
    pub timestamp: i64,
    pub download_speed: i64,
    pub upload_speed: i64,
}

pub mod queries;

