use anyhow::Result;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use std::path::Path;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetadataRecord {
    pub id: String,
    pub media_type: String, // "movie", "tv", "music", "ebook", "game", "software"
    pub title: String,
    pub year: Option<i64>,
    pub overview: Option<String>,
    pub poster_url: Option<String>,
    pub backdrop_url: Option<String>,
    pub rating: Option<f64>,
    pub genres: Vec<String>,
    pub tmdb_id: Option<i64>,
    pub cached_at: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TmdbSearchResult {
    pub id: i64,
    pub title: Option<String>,
    pub name: Option<String>,
    pub overview: Option<String>,
    pub poster_path: Option<String>,
    pub backdrop_path: Option<String>,
    pub release_date: Option<String>,
    pub first_air_date: Option<String>,
    pub vote_average: Option<f64>,
    pub genre_ids: Option<Vec<i64>>,
    pub media_type: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TmdbSearchResponse {
    results: Vec<TmdbSearchResult>,
}

pub struct MetadataClient {
    client: Client,
    api_key: String,
}

impl MetadataClient {
    pub fn new(api_key: String) -> Self {
        Self {
            client: Client::builder()
                .timeout(std::time::Duration::from_secs(10))
                .build()
                .unwrap_or_default(),
            api_key,
        }
    }

    pub async fn search_multi(&self, query: &str) -> Result<Vec<TmdbSearchResult>> {
        let url = format!(
            "https://api.themoviedb.org/3/search/multi?api_key={}&query={}&include_adult=false",
            self.api_key,
            urlencoding::encode(query)
        );
        let resp: TmdbSearchResponse = self.client.get(&url).send().await?.json().await?;
        Ok(resp.results)
    }

    pub async fn get_movie(&self, tmdb_id: i64) -> Result<MetadataRecord> {
        let url = format!(
            "https://api.themoviedb.org/3/movie/{}?api_key={}&append_to_response=genres",
            tmdb_id, self.api_key
        );
        #[derive(Deserialize)]
        struct TmdbMovie {
            id: i64,
            title: String,
            overview: Option<String>,
            poster_path: Option<String>,
            backdrop_path: Option<String>,
            release_date: Option<String>,
            vote_average: Option<f64>,
            genres: Option<Vec<TmdbGenre>>,
        }
        #[derive(Deserialize)]
        struct TmdbGenre { name: String }

        let movie: TmdbMovie = self.client.get(&url).send().await?.json().await?;
        let year = movie.release_date.as_deref()
            .and_then(|d| d.split('-').next())
            .and_then(|y| y.parse::<i64>().ok());

        Ok(MetadataRecord {
            id: Uuid::new_v4().to_string(),
            media_type: "movie".to_string(),
            title: movie.title,
            year,
            overview: movie.overview,
            poster_url: movie.poster_path.map(|p| format!("https://image.tmdb.org/t/p/w500{}", p)),
            backdrop_url: movie.backdrop_path.map(|p| format!("https://image.tmdb.org/t/p/w1280{}", p)),
            rating: movie.vote_average,
            genres: movie.genres.unwrap_or_default().into_iter().map(|g| g.name).collect(),
            tmdb_id: Some(movie.id),
            cached_at: chrono::Utc::now().timestamp(),
        })
    }

    pub async fn get_tv(&self, tmdb_id: i64) -> Result<MetadataRecord> {
        let url = format!(
            "https://api.themoviedb.org/3/tv/{}?api_key={}&append_to_response=genres",
            tmdb_id, self.api_key
        );
        #[derive(Deserialize)]
        struct TmdbTv {
            id: i64,
            name: String,
            overview: Option<String>,
            poster_path: Option<String>,
            backdrop_path: Option<String>,
            first_air_date: Option<String>,
            vote_average: Option<f64>,
            genres: Option<Vec<TmdbGenre>>,
        }
        #[derive(Deserialize)]
        struct TmdbGenre { name: String }

        let tv: TmdbTv = self.client.get(&url).send().await?.json().await?;
        let year = tv.first_air_date.as_deref()
            .and_then(|d| d.split('-').next())
            .and_then(|y| y.parse::<i64>().ok());

        Ok(MetadataRecord {
            id: Uuid::new_v4().to_string(),
            media_type: "tv".to_string(),
            title: tv.name,
            year,
            overview: tv.overview,
            poster_url: tv.poster_path.map(|p| format!("https://image.tmdb.org/t/p/w500{}", p)),
            backdrop_url: tv.backdrop_path.map(|p| format!("https://image.tmdb.org/t/p/w1280{}", p)),
            rating: tv.vote_average,
            genres: tv.genres.unwrap_or_default().into_iter().map(|g| g.name).collect(),
            tmdb_id: Some(tv.id),
            cached_at: chrono::Utc::now().timestamp(),
        })
    }

    /// Auto-detect and fetch metadata for a torrent name
    pub async fn auto_fetch(&self, torrent_name: &str) -> Result<Option<MetadataRecord>> {
        // Strip common suffixes and quality tags
        let clean = clean_torrent_name(torrent_name);
        let results = self.search_multi(&clean).await?;
        if let Some(first) = results.into_iter().next() {
            let media_type = first.media_type.as_deref().unwrap_or("movie");
            let record = match media_type {
                "tv" => self.get_tv(first.id).await.ok(),
                _ => self.get_movie(first.id).await.ok(),
            };
            return Ok(record);
        }
        Ok(None)
    }
}

/// Classify file type from torrent name/extension
pub fn classify_media_type(name: &str) -> &'static str {
    let lower = name.to_lowercase();
    if lower.ends_with(".mp4") || lower.ends_with(".mkv") || lower.ends_with(".avi")
        || lower.ends_with(".mov") || lower.ends_with(".webm") || lower.ends_with(".m4v")
    {
        return "video";
    }
    if lower.ends_with(".mp3") || lower.ends_with(".flac") || lower.ends_with(".aac")
        || lower.ends_with(".wav") || lower.ends_with(".ogg") || lower.ends_with(".m4a")
    {
        return "audio";
    }
    if lower.ends_with(".epub") || lower.ends_with(".pdf") || lower.ends_with(".mobi")
        || lower.ends_with(".azw") || lower.ends_with(".djvu")
    {
        return "ebook";
    }
    if lower.ends_with(".zip") || lower.ends_with(".rar") || lower.ends_with(".7z")
        || lower.ends_with(".exe") || lower.ends_with(".msi") || lower.ends_with(".dmg")
    {
        return "software";
    }
    "other"
}

/// Generate the destination path from a template
/// Supported vars: {title}, {year}, {category}, {media_type}, {ext}
pub fn resolve_organize_path(template: &str, meta: &MetadataRecord, filename: &str) -> String {
    let ext = Path::new(filename)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");

    template
        .replace("{title}", &sanitize_path(&meta.title))
        .replace("{year}", &meta.year.map(|y| y.to_string()).unwrap_or_default())
        .replace("{media_type}", &meta.media_type)
        .replace("{ext}", ext)
}

fn sanitize_path(s: &str) -> String {
    s.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            c => c,
        })
        .collect()
}

fn clean_torrent_name(name: &str) -> String {
    // Remove common quality/encoding tags
    let re_patterns = [
        r"(?i)\b(1080p|720p|4k|2160p|480p|bluray|blu-ray|webrip|web-dl|hdtv|dvdrip|dvdscr|cam|ts|hdrip)\b",
        r"(?i)\b(x264|x265|hevc|avc|xvid|divx|h\.264|h\.265|h264|h265)\b",
        r"(?i)\b(aac|ac3|dts|mp3|dd5\.1|truehd|atmos)\b",
        r"(?i)\b(extended|unrated|directors\.cut|theatrical|remastered|proper|repack)\b",
        r"\[.*?\]|\(.*?\)",
        r"[\.\-\_]",
    ];

    let mut clean = name.to_string();
    for pat in re_patterns {
        if let Ok(re) = regex::Regex::new(pat) {
            clean = re.replace_all(&clean, " ").to_string();
        }
    }

    // Remove year-like patterns at end
    if let Ok(re) = regex::Regex::new(r"\s+\d{4}\s*$") {
        clean = re.replace_all(&clean, "").to_string();
    }

    clean.split_whitespace().collect::<Vec<_>>().join(" ").trim().to_string()
}
