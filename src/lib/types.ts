export interface TorrentRecord {
  id: string;
  name: string;
  info_hash: string;
  magnet_uri?: string;
  torrent_file_path?: string;
  save_path: string;
  status: TorrentStatus;
  category?: string;
  label?: string;
  added_at: number;
  completed_at?: number;
  total_size: number;
  downloaded: number;
  uploaded: number;
  download_limit?: number;
  upload_limit?: number;
  max_peers?: number;
  sequential_download: number;
  priority: number;
  metadata_id?: string;
  metadata_type?: string;
  notes?: string;
}

export type TorrentStatus =
  | "downloading"
  | "seeding"
  | "paused"
  | "checking"
  | "queued"
  | "error"
  | "unknown";

export interface TorrentProgress {
  id: string;
  status: TorrentStatus;
  downloaded: number;
  uploaded: number;
  total_size: number;
  progress: number;
  download_speed: number;
  upload_speed: number;
  eta_seconds?: number;
  num_peers: number;
  num_seeders: number;
  piece_availability: number;
}

export interface TorrentSummary {
  record: TorrentRecord;
  live?: TorrentProgress;
  health_score: number;
}

export interface TorrentFileInfo {
  index: number;
  path: string;
  size: number;
  downloaded: number;
  progress: number;
  priority: number;
  wanted: boolean;
}

export interface PeerInfo {
  addr: string;
  country?: string;
  client?: string;
  download_speed: number;
  upload_speed: number;
  progress: number;
  flags: string;
}

export interface TrackerInfo {
  url: string;
  status: string;
  peers: number;
  seeds: number;
  last_announce?: number;
  next_announce?: number;
  message?: string;
}

export interface AppSettings {
  default_download_path: string;
  listen_port: number;
  max_active_torrents: number;
  max_download_speed: number;
  max_upload_speed: number;
  max_connections_global: number;
  max_connections_per_torrent: number;
  enable_dht: boolean;
  enable_pex: boolean;
  enable_lsd: boolean;
  upnp_enabled: boolean;
  natpmp_enabled: boolean;
  encryption_mode: string;
  tmdb_api_key: string;
  auto_organize_template: string;
  plex_url?: string;
  jellyfin_url?: string;
  jellyfin_api_key?: string;
  remote_enabled: boolean;
  remote_token: string;
  start_minimized: boolean;
  minimize_to_tray: boolean;
  auto_start: boolean;
  completed_action: string;
  seed_ratio_limit: number;
  seed_time_limit: number;
  sequential_default: boolean;
  disk_cache_mb: number;
  theme: string;
  notify_on_complete: boolean;
  notify_on_rss: boolean;
}

export interface GlobalStats {
  download_speed: number;
  upload_speed: number;
  num_downloading: number;
  num_seeding: number;
  num_paused: number;
  num_checking: number;
  num_error: number;
  session_downloaded: number;
  session_uploaded: number;
  all_time_downloaded: number;
  all_time_uploaded: number;
  dht_nodes: number;
  free_disk_bytes: number;
  listen_port: number;
  version: string;
}

export interface RssFeed {
  id: string;
  name: string;
  url: string;
  enabled: number;
  interval_minutes: number;
  last_fetched?: number;
  created_at: number;
}

export interface RssFilterRule {
  id: string;
  feed_id?: string;
  name: string;
  pattern: string;
  exclude_pattern?: string;
  min_size?: number;
  max_size?: number;
  save_path?: string;
  category?: string;
  label?: string;
  enabled: number;
  quality_filter?: string;
  created_at: number;
}

export interface RssItem {
  title: string;
  link: string;
  size?: number;
  pub_date?: string;
  description?: string;
}

export interface MetadataRecord {
  id: string;
  media_type: string;
  title: string;
  year?: number;
  overview?: string;
  poster_url?: string;
  backdrop_url?: string;
  rating?: number;
  genres: string[];
  tmdb_id?: number;
  cached_at: number;
}

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  overview?: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  first_air_date?: string;
  vote_average?: number;
  genre_ids?: number[];
  media_type?: string;
}

export interface ProxyConfig {
  enabled: boolean;
  proxy_type: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
  per_torrent: boolean;
}

export interface WebhookConfig {
  id: string;
  name: string;
  url: string;
  events: string[];
  enabled: boolean;
}

export interface SpeedSample {
  timestamp: number;
  download_speed: number;
  upload_speed: number;
}

// Filter types for the sidebar
export type SidebarFilter =
  | "all"
  | "downloading"
  | "seeding"
  | "completed"
  | "paused"
  | "checking"
  | "error"
  | `label:${string}`
  | `category:${string}`;
