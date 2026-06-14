import { useState } from "react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import * as api from "../../lib/tauri-commands";
import { useSettingsStore } from "../../stores/settingsStore";
import { useTorrentStore } from "../../stores/torrentStore";
import { X, FolderOpen, Magnet } from "lucide-react";

interface AddTorrentDialogProps {
  open: boolean;
  onClose: () => void;
}

export default function AddTorrentDialog({ open, onClose }: AddTorrentDialogProps) {
  const settings = useSettingsStore((s) => s.settings);
  const fetchTorrents = useTorrentStore((s) => s.fetchTorrents);

  const [tab, setTab] = useState<"file" | "magnet">("file");
  const [torrentPath, setTorrentPath] = useState("");
  const [magnetUri, setMagnetUri] = useState("");
  const [savePath, setSavePath] = useState(settings?.default_download_path ?? "");
  const [paused, setPaused] = useState(false);
  const [category, setCategory] = useState("");
  const [label, setLabel] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const handleBrowseTorrent = async () => {
    const path = await openDialog({ filters: [{ name: "Torrent", extensions: ["torrent"] }] });
    if (typeof path === "string") setTorrentPath(path);
  };

  const handleBrowseSave = async () => {
    const path = await openDialog({ directory: true });
    if (typeof path === "string") setSavePath(path);
  };

  const handleAdd = async () => {
    setError("");
    setLoading(true);
    try {
      if (tab === "file") {
        if (!torrentPath) { setError("Select a .torrent file"); setLoading(false); return; }
        await api.addTorrentFile({
          path: torrentPath,
          save_path: savePath,
          paused,
          category: category || undefined,
          label: label || undefined,
        });
      } else {
        if (!magnetUri) { setError("Enter a magnet link"); setLoading(false); return; }
        await api.addTorrentMagnet({
          magnet: magnetUri,
          save_path: savePath,
          paused,
          category: category || undefined,
          label: label || undefined,
        });
      }
      await fetchTorrents();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-[540px] p-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-base">Add Torrent</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-border">
          <button
            onClick={() => setTab("file")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === "file" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            .torrent File
          </button>
          <button
            onClick={() => setTab("magnet")}
            className={`px-5 py-2.5 text-sm font-medium transition-colors ${tab === "magnet" ? "border-b-2 border-primary text-primary" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Magnet className="w-3.5 h-3.5 inline mr-1.5" />
            Magnet Link
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* File or magnet */}
          {tab === "file" ? (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Torrent File</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={torrentPath}
                  readOnly
                  placeholder="Select a .torrent file..."
                  className="flex-1 bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
                />
                <button
                  onClick={handleBrowseTorrent}
                  className="px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors text-sm flex items-center gap-1.5"
                >
                  <FolderOpen className="w-4 h-4" />
                  Browse
                </button>
              </div>
            </div>
          ) : (
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">Magnet Link</label>
              <textarea
                value={magnetUri}
                onChange={(e) => setMagnetUri(e.target.value)}
                placeholder="magnet:?xt=urn:btih:..."
                rows={3}
                className="w-full bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary font-mono resize-none"
              />
            </div>
          )}

          {/* Save path */}
          <div>
            <label className="text-xs text-muted-foreground mb-1 block">Save to</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                className="flex-1 bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
              <button
                onClick={handleBrowseSave}
                className="px-3 py-1.5 rounded border border-border hover:bg-muted transition-colors text-sm"
              >
                <FolderOpen className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Category / Label */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Category (optional)</label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
            <div className="flex-1">
              <label className="text-xs text-muted-foreground mb-1 block">Label (optional)</label>
              <input
                type="text"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                className="w-full bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          {/* Options */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="paused"
              checked={paused}
              onChange={(e) => setPaused(e.target.checked)}
              className="rounded"
            />
            <label htmlFor="paused" className="text-sm text-muted-foreground">
              Add in paused state
            </label>
          </div>

          {error && (
            <div className="px-3 py-2 rounded bg-destructive/15 border border-destructive/30 text-sm text-destructive">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded border border-border hover:bg-muted text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleAdd}
            disabled={loading}
            className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50 transition-colors"
          >
            {loading ? "Adding..." : "Add Torrent"}
          </button>
        </div>
      </div>
    </div>
  );
}
