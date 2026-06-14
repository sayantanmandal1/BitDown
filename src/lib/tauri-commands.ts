import { invoke } from "@tauri-apps/api/core";
import type {
  TorrentRecord, TorrentSummary, TorrentFileInfo, PeerInfo,
  TrackerInfo, AppSettings, GlobalStats, RssFeed, RssFilterRule,
  RssItem, MetadataRecord, TmdbSearchResult, ProxyConfig,
  WebhookConfig, SpeedSample,
} from "./types";

// ─── Torrent commands ─────────────────────────────────────────────────────────

export const addTorrentFile = (args: {
  path: string; save_path: string; paused: boolean;
  category?: string; label?: string; skip_hash_check?: boolean;
}) => invoke<TorrentRecord>("add_torrent_file", {
  path: args.path,
  savePath: args.save_path,
  paused: args.paused,
  category: args.category ?? null,
  label: args.label ?? null,
  skipHashCheck: args.skip_hash_check ?? false,
});

export const addTorrentMagnet = (args: {
  magnet: string; save_path: string; paused: boolean;
  category?: string; label?: string;
}) => invoke<TorrentRecord>("add_torrent_magnet", {
  magnet: args.magnet,
  savePath: args.save_path,
  paused: args.paused,
  category: args.category ?? null,
  label: args.label ?? null,
});

export const removeTorrent = (id: string, delete_files: boolean) =>
  invoke<void>("remove_torrent", { id, deleteFiles: delete_files });

export const pauseTorrent = (id: string) => invoke<void>("pause_torrent", { id });
export const resumeTorrent = (id: string) => invoke<void>("resume_torrent", { id });

export const getAllTorrents = () => invoke<TorrentSummary[]>("get_all_torrents");

export const getTorrentDetails = (id: string) =>
  invoke<TorrentRecord | null>("get_torrent_details", { id });

export const getTorrentFiles = (id: string) =>
  invoke<TorrentFileInfo[]>("get_torrent_files", { id });

export const getTorrentPeers = (id: string) =>
  invoke<PeerInfo[]>("get_torrent_peers", { id });

export const getTorrentTrackers = (id: string) =>
  invoke<TrackerInfo[]>("get_torrent_trackers", { id });

export const setFilePriority = (torrent_id: string, file_index: number, priority: number) =>
  invoke<void>("set_file_priority", { torrentId: torrent_id, fileIndex: file_index, priority });

export const forceRecheck = (id: string) => invoke<void>("force_recheck", { id });

export const openDownloadFolder = (id: string) =>
  invoke<void>("open_download_folder", { id });

export const getTorrentPieceMap = (id: string) =>
  invoke<number[]>("get_torrent_piece_map", { id });

export const getSpeedHistory = (torrent_id: string | null, seconds: number) =>
  invoke<SpeedSample[]>("get_speed_history", { torrentId: torrent_id, seconds });

export const setTorrentLabel = (id: string, label: string | null) =>
  invoke<void>("set_torrent_label", { id, label });

export const setDownloadLimit = (id: string, bytes_per_sec: number | null) =>
  invoke<void>("set_download_limit", { id, bytesPerSec: bytes_per_sec });

export const setUploadLimit = (id: string, bytes_per_sec: number | null) =>
  invoke<void>("set_upload_limit", { id, bytesPerSec: bytes_per_sec });

// ─── Streaming commands ───────────────────────────────────────────────────────

export const startStream = (torrent_id: string, file_index: number) =>
  invoke<string>("start_stream", { torrentId: torrent_id, fileIndex: file_index });

export const stopStream = (torrent_id: string) =>
  invoke<void>("stop_stream", { torrentId: torrent_id });

export const getStreamUrl = (torrent_id: string, file_index: number, use_hls = false) =>
  invoke<string>("get_stream_url", { torrentId: torrent_id, fileIndex: file_index, useHls: use_hls });

// ─── Metadata commands ────────────────────────────────────────────────────────

export const fetchMetadata = (torrent_id: string) =>
  invoke<MetadataRecord | null>("fetch_metadata", { torrentId: torrent_id });

export const searchTmdb = (query: string) =>
  invoke<TmdbSearchResult[]>("search_tmdb", { query });

export const getCachedMetadata = (id: string) =>
  invoke<MetadataRecord | null>("get_cached_metadata", { id });

export const previewOrganize = (torrent_id: string, template: string) =>
  invoke<[string, string][]>("preview_organize", { torrentId: torrent_id, template });

export const autoOrganize = (torrent_id: string, template: string) =>
  invoke<[string, string][]>("auto_organize", { torrentId: torrent_id, template });

// ─── Privacy commands ─────────────────────────────────────────────────────────

export const setProxyConfig = (config: ProxyConfig) =>
  invoke<void>("set_proxy_config", { config });

export const getProxyConfig = () => invoke<ProxyConfig>("get_proxy_config");

export const testProxy = (config: ProxyConfig) =>
  invoke<string>("test_proxy", { config });

export const loadBlocklist = (path: string) =>
  invoke<number>("load_blocklist", { path });

export const getBlocklistStats = () =>
  invoke<{ path: string | null; count: number; enabled: boolean }>("get_blocklist_stats");

export const setKillswitch = (enabled: boolean) =>
  invoke<void>("set_killswitch", { enabled });

export const testIpLeak = () => invoke<string[]>("test_ip_leak");

// ─── RSS commands ─────────────────────────────────────────────────────────────

export const addFeed = (name: string, url: string, interval_minutes: number) =>
  invoke<RssFeed>("add_feed", { name, url, intervalMinutes: interval_minutes });

export const removeFeed = (id: string) => invoke<void>("remove_feed", { id });
export const getFeeds = () => invoke<RssFeed[]>("get_feeds");

export const refreshFeed = (url: string) => invoke<RssItem[]>("refresh_feed", { url });

export const addFilterRule = (
  feed_id: string | undefined,
  name: string,
  pattern: string,
  exclude_pattern?: string,
  min_size?: number,
  max_size?: number,
  save_path?: string,
  category?: string,
  label?: string,
  quality_filter?: string,
) => invoke<RssFilterRule>("add_filter_rule", {
  feedId: feed_id ?? null, name, pattern,
  excludePattern: exclude_pattern ?? null,
  minSize: min_size ?? null,
  maxSize: max_size ?? null,
  savePath: save_path ?? null,
  category: category ?? null,
  label: label ?? null,
  qualityFilter: quality_filter ?? null,
});

export const removeFilterRule = (id: string) =>
  invoke<void>("remove_filter_rule", { id });

export const getFilterRules = (feed_id?: string) =>
  invoke<RssFilterRule[]>("get_filter_rules", { feedId: feed_id ?? null });

// ─── Settings commands ────────────────────────────────────────────────────────

export const getSettings = () => invoke<AppSettings>("get_settings");
export const saveSettings = (settings: AppSettings) =>
  invoke<void>("save_settings", { settings });

export const getGlobalStats = () => invoke<GlobalStats>("get_global_stats");

export const generateRemoteToken = () =>
  invoke<string>("generate_remote_token");

export const getRemoteQr = () => invoke<string>("get_remote_qr");

export const testWebhook = (url: string) =>
  invoke<boolean>("test_webhook", { url });

export const addWebhook = (name: string, url: string, events: string[]) =>
  invoke<WebhookConfig>("add_webhook", { name, url, events });

export const removeWebhook = (id: string) =>
  invoke<void>("remove_webhook", { id });
