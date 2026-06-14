import {
  Plus, Trash2, Play, Pause, RefreshCw, FolderOpen, Settings, Search, ChevronDown,
} from "lucide-react";
import { useTorrentStore } from "../../stores/torrentStore";
import { useState } from "react";

const BTN = "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-xs transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed";
const BTN_GHOST = `${BTN} text-white/60 hover:text-white/90 hover:bg-white/[0.06]`;
const DIVIDER = "w-px h-5 mx-1 bg-white/[0.08]";

interface ToolbarProps {
  onAddTorrent: () => void;
  onOpenSettings: () => void;
}

export default function Toolbar({ onAddTorrent, onOpenSettings }: ToolbarProps) {
  const selectedIds    = useTorrentStore((s) => s.selectedIds);
  const pauseSelected  = useTorrentStore((s) => s.pauseSelected);
  const resumeSelected = useTorrentStore((s) => s.resumeSelected);
  const removeSelected = useTorrentStore((s) => s.removeSelected);
  const setSearchQuery = useTorrentStore((s) => s.setSearchQuery);
  const searchQuery    = useTorrentStore((s) => s.searchQuery);
  const fetchTorrents  = useTorrentStore((s) => s.fetchTorrents);
  const [removeOpen, setRemoveOpen] = useState(false);
  const hasSelected = selectedIds.size > 0;

  return (
    <div
      className="flex items-center gap-0.5 px-2 py-1.5 flex-shrink-0"
      style={{
        background: "rgba(255,255,255,0.03)",
        borderBottom: "1px solid rgba(255,255,255,0.07)",
        backdropFilter: "blur(20px)",
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 pr-3 mr-1" style={{ borderRight: "1px solid rgba(255,255,255,0.07)" }}>
        <img src="/bitdown.svg" width="26" height="26" alt="BitDown" style={{ display: "block", flexShrink: 0, borderRadius: 5 }} />
        <span className="font-semibold text-xs tracking-widest text-white/70">BITDOWN</span>
      </div>

      {/* Add */}
      <button
        onClick={onAddTorrent}
        className={`${BTN} text-white/90 font-medium`}
        style={{ background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.15)" }}
        title="Add torrent (Ctrl+O)"
      >
        <Plus className="w-3.5 h-3.5" />
        Add
      </button>

      <div className={DIVIDER} />

      {/* Remove */}
      <div className="relative">
        <div className="flex">
          <button onClick={() => removeSelected(false)} disabled={!hasSelected} className={BTN_GHOST} title="Remove">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setRemoveOpen(v => !v)} disabled={!hasSelected} className={`${BTN_GHOST} pl-0.5`}>
            <ChevronDown className="w-3 h-3" />
          </button>
        </div>
        {removeOpen && hasSelected && (
          <div className="absolute top-full left-0 mt-1 z-50 py-1 min-w-44 rounded-lg shadow-2xl"
               style={{ background: "rgba(16,16,16,0.95)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(20px)" }}>
            <button onClick={() => { removeSelected(false); setRemoveOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-white/75 hover:bg-white/[0.06] hover:text-white/95">
              Remove (keep files)
            </button>
            <button onClick={() => { removeSelected(true); setRemoveOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10">
              Remove + delete files
            </button>
          </div>
        )}
      </div>

      {/* Pause / Resume */}
      <button onClick={() => pauseSelected()} disabled={!hasSelected} className={BTN_GHOST} title="Pause selected">
        <Pause className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => resumeSelected()} disabled={!hasSelected} className={BTN_GHOST} title="Resume selected">
        <Play className="w-3.5 h-3.5" />
      </button>
      <button onClick={() => fetchTorrents()} className={BTN_GHOST} title="Refresh">
        <RefreshCw className="w-3.5 h-3.5" />
      </button>
      <button className={BTN_GHOST} title="Open download folder" disabled={!hasSelected}>
        <FolderOpen className="w-3.5 h-3.5" />
      </button>

      <div className="flex-1" />

      {/* Search */}
      <div className="relative mr-2">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search torrents..."
          className="pl-7 pr-3 py-1.5 text-xs rounded-md focus:outline-none w-48"
          style={{
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "rgba(255,255,255,0.85)",
            caretColor: "rgba(255,255,255,0.7)",
          }}
        />
      </div>

      {/* Settings */}
      <button onClick={onOpenSettings} className={BTN_GHOST} title="Settings">
        <Settings className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

