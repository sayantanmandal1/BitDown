CREATE TABLE IF NOT EXISTS torrents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    info_hash TEXT NOT NULL UNIQUE,
    magnet_uri TEXT,
    torrent_file_path TEXT,
    save_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'paused',
    category TEXT,
    label TEXT,
    added_at INTEGER NOT NULL,
    completed_at INTEGER,
    total_size INTEGER NOT NULL DEFAULT 0,
    downloaded INTEGER NOT NULL DEFAULT 0,
    uploaded INTEGER NOT NULL DEFAULT 0,
    download_limit INTEGER,
    upload_limit INTEGER,
    max_peers INTEGER,
    sequential_download INTEGER NOT NULL DEFAULT 0,
    priority INTEGER NOT NULL DEFAULT 5,
    metadata_id TEXT,
    metadata_type TEXT,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS speed_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torrent_id TEXT,
    timestamp INTEGER NOT NULL,
    download_speed INTEGER NOT NULL,
    upload_speed INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_feeds (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    interval_minutes INTEGER NOT NULL DEFAULT 30,
    last_fetched INTEGER,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS rss_filter_rules (
    id TEXT PRIMARY KEY,
    feed_id TEXT,
    name TEXT NOT NULL,
    pattern TEXT NOT NULL,
    exclude_pattern TEXT,
    min_size INTEGER,
    max_size INTEGER,
    save_path TEXT,
    category TEXT,
    label TEXT,
    enabled INTEGER NOT NULL DEFAULT 1,
    quality_filter TEXT,
    created_at INTEGER NOT NULL,
    FOREIGN KEY (feed_id) REFERENCES rss_feeds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rss_history (
    id TEXT PRIMARY KEY,
    feed_id TEXT NOT NULL,
    title TEXT NOT NULL,
    link TEXT NOT NULL,
    torrent_added INTEGER NOT NULL DEFAULT 0,
    added_at INTEGER NOT NULL,
    FOREIGN KEY (feed_id) REFERENCES rss_feeds(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS torrent_trackers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torrent_id TEXT NOT NULL,
    url TEXT NOT NULL,
    status TEXT,
    peers INTEGER DEFAULT 0,
    seeds INTEGER DEFAULT 0,
    last_announce INTEGER,
    FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS metadata_cache (
    id TEXT PRIMARY KEY,
    media_type TEXT NOT NULL,
    title TEXT NOT NULL,
    year INTEGER,
    overview TEXT,
    poster_url TEXT,
    backdrop_url TEXT,
    rating REAL,
    genres TEXT,
    tmdb_id INTEGER,
    cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    events TEXT NOT NULL,
    enabled INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS peer_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    torrent_id TEXT NOT NULL,
    ip TEXT NOT NULL,
    country TEXT,
    client TEXT,
    download_speed INTEGER DEFAULT 0,
    upload_speed INTEGER DEFAULT 0,
    progress REAL DEFAULT 0,
    recorded_at INTEGER NOT NULL,
    FOREIGN KEY (torrent_id) REFERENCES torrents(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_speed_history_torrent ON speed_history(torrent_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_speed_history_time ON speed_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_rss_history_feed ON rss_history(feed_id);
CREATE INDEX IF NOT EXISTS idx_peer_stats_torrent ON peer_stats(torrent_id);
