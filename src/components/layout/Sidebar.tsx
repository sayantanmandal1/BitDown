import { Download, Upload, CheckCircle, PauseCircle, AlertCircle, RotateCcw, Folder, Tag, Filter, Rss } from "lucide-react";
import { useTorrentStore } from "../../stores/torrentStore";
import type { SidebarFilter } from "../../lib/types";
import { cn } from "../../lib/utils";

const FILTERS: { id: SidebarFilter; label: string; icon: React.FC<any> }[] = [
  { id: "all",         label: "All Torrents",  icon: Folder },
  { id: "downloading", label: "Downloading",   icon: Download },
  { id: "seeding",     label: "Seeding",       icon: Upload },
  { id: "completed",   label: "Completed",     icon: CheckCircle },
  { id: "paused",      label: "Paused",        icon: PauseCircle },
  { id: "checking",    label: "Checking",      icon: RotateCcw },
  { id: "error",       label: "Error",         icon: AlertCircle },
];

interface SidebarProps {
  onNavigate: (v: "torrents" | "rss") => void;
  activeView: "torrents" | "rss";
}

export default function Sidebar({ onNavigate, activeView }: SidebarProps) {
  const torrents     = useTorrentStore((s) => s.torrents);
  const activeFilter = useTorrentStore((s) => s.activeFilter);
  const setActiveFilter = useTorrentStore((s) => s.setActiveFilter);

  const counts: Record<string, number> = { all: torrents.length };
  for (const t of torrents) {
    const s = t.record.status;
    counts[s] = (counts[s] ?? 0) + 1;
  }
  counts.completed = torrents.filter(t => t.record.status === "seeding" || (t.live?.progress ?? 0) >= 1).length;

  const labels = [...new Set(torrents.map(t => t.record.label).filter(Boolean))] as string[];
  const categories = [...new Set(torrents.map(t => t.record.category).filter(Boolean))] as string[];

  const NavBtn = ({ id, label, icon: Icon, count }: { id: SidebarFilter; label: string; icon: React.FC<any>; count?: number }) => {
    const isActive = activeFilter === id && activeView === "torrents";
    return (
      <button
        onClick={() => { if (activeView !== "torrents") onNavigate("torrents"); setActiveFilter(id); }}
        className={cn("w-full flex items-center justify-between px-3 py-1.5 rounded-md text-xs transition-all duration-100", isActive ? "nav-btn active" : "nav-btn")}
      >
        <span className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 flex-shrink-0" />
          {label}
        </span>
        {!!count && <span className="tabular-nums text-white/30 text-[10px]">{count}</span>}
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full py-2 overflow-y-auto" style={{ background: "rgba(255,255,255,0.02)" }}>
      {/* Main filters */}
      <div className="px-2 space-y-0.5">
        {FILTERS.map(({ id, label, icon }) => (
          <NavBtn key={id} id={id} label={label} icon={icon} count={counts[id === "all" ? "all" : id]} />
        ))}
      </div>

      {/* Labels */}
      {labels.length > 0 && (
        <div className="mt-4 px-2">
          <div className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Tag className="w-3 h-3" /> Labels
          </div>
          {labels.map(l => (
            <button key={l}
              onClick={() => setActiveFilter(`label:${l}` as SidebarFilter)}
              className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-100",
                activeFilter === `label:${l}` ? "nav-btn active" : "nav-btn")}>
              <span className="w-2 h-2 rounded-full bg-white/30 flex-shrink-0" />
              {l}
            </button>
          ))}
        </div>
      )}

      {/* Categories */}
      {categories.length > 0 && (
        <div className="mt-4 px-2">
          <div className="px-3 py-1 text-[10px] text-white/30 uppercase tracking-wider flex items-center gap-1.5 mb-1">
            <Filter className="w-3 h-3" /> Categories
          </div>
          {categories.map(cat => (
            <button key={cat}
              onClick={() => setActiveFilter(`category:${cat}` as SidebarFilter)}
              className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-100",
                activeFilter === `category:${cat}` ? "nav-btn active" : "nav-btn")}>
              <Folder className="w-3 h-3 flex-shrink-0" />
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {/* RSS nav */}
      <div className="px-2 mt-2 pb-1" style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 8 }}>
        <button
          onClick={() => onNavigate(activeView === "rss" ? "torrents" : "rss")}
          className={cn("w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-xs transition-all duration-100",
            activeView === "rss" ? "nav-btn active" : "nav-btn")}
        >
          <Rss className="w-3.5 h-3.5 flex-shrink-0" />
          RSS Feeds
        </button>
      </div>
    </div>
  );
}

