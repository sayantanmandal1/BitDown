import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB", "TB", "PB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function formatSpeed(bytesPerSec: number): string {
  return formatBytes(bytesPerSec) + "/s";
}

export function formatEta(seconds?: number): string {
  if (!seconds || seconds <= 0) return "∞";
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function formatProgress(progress: number): string {
  return (progress * 100).toFixed(1) + "%";
}

export function formatRatio(downloaded: number, uploaded: number): string {
  if (downloaded === 0) return "∞";
  return (uploaded / downloaded).toFixed(2);
}

export function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

export function formatDateShort(timestamp: number): string {
  const d = new Date(timestamp * 1000);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60_000) return "Just now";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return d.toLocaleDateString();
}

export function isVideoFile(filename: string): boolean {
  return /\.(mp4|mkv|avi|mov|webm|m4v|flv|wmv|ts)$/i.test(filename);
}

export function isAudioFile(filename: string): boolean {
  return /\.(mp3|flac|aac|wav|ogg|m4a|opus|wma)$/i.test(filename);
}

export function torrentStatusColor(status: string): string {
  switch (status) {
    case "downloading": return "text-[rgba(130,190,255,0.9)]";
    case "seeding":     return "text-[rgba(100,220,150,0.9)]";
    case "paused":      return "text-white/40";
    case "checking":    return "text-[rgba(255,210,100,0.9)]";
    case "error":       return "text-[rgba(255,120,120,0.9)]";
    default:            return "text-white/40";
  }
}

export function torrentStatusBadgeClass(status: string): string {
  switch (status) {
    case "downloading": return "badge-down";
    case "seeding":     return "badge-seed";
    case "paused":      return "badge-pause";
    case "checking":    return "badge-check";
    case "error":       return "badge-error";
    default:            return "badge-pause";
  }
}

export function torrentStatusBg(status: string): string {
  return torrentStatusBadgeClass(status);
}

export function progressBarClass(status: string): string {
  switch (status) {
    case "downloading": return "progress-fill-download";
    case "seeding":     return "progress-fill-seed";
    case "checking":    return "progress-fill-check";
    default:            return "progress-fill-pause";
  }
}

export function healthScoreColor(score: number): string {
  if (score >= 70) return "text-[rgba(100,220,150,0.9)]";
  if (score >= 40) return "text-[rgba(255,210,100,0.9)]";
  return "text-[rgba(255,120,120,0.9)]";
}

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
