import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import * as api from "../../lib/tauri-commands";
import type { RssFeed, RssFilterRule } from "../../lib/types";
import { formatDate } from "../../lib/utils";
import { Plus, Trash2, RefreshCw, Filter, Rss, X } from "lucide-react";

const inp = "w-full bg-background border border-input rounded px-2.5 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-ring";
const btn = "px-3 py-1.5 rounded text-sm transition-colors";

export default function RSSManager() {
  const qc = useQueryClient();
  const [selectedFeed, setSelectedFeed] = useState<string | null>(null);
  const [addFeedOpen, setAddFeedOpen] = useState(false);
  const [addFilterOpen, setAddFilterOpen] = useState(false);

  const { data: feeds = [] } = useQuery({
    queryKey: ["rss-feeds"],
    queryFn: api.getFeeds,
    refetchInterval: 30000,
  });

  const { data: filters = [] } = useQuery({
    queryKey: ["rss-filters", selectedFeed],
    queryFn: () => api.getFilterRules(selectedFeed ?? undefined),
    enabled: true,
    refetchInterval: 30000,
  });

  const removeFeed = useMutation({
    mutationFn: api.removeFeed,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rss-feeds"] }),
  });

  const removeFilter = useMutation({
    mutationFn: api.removeFilterRule,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rss-filters"] }),
  });

  const refreshFeed = async (feed: RssFeed) => {
    try { await api.refreshFeed(feed.url); }
    catch (e) { console.error(e); }
  };

  return (
    <div className="flex h-full">
      {/* Feed list */}
      <div className="w-64 flex-shrink-0 border-r border-border flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-medium text-sm"><Rss className="w-4 h-4 text-primary" />RSS Feeds</div>
          <button onClick={() => setAddFeedOpen(true)} className="p-1 rounded hover:bg-muted" title="Add feed">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {feeds.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground text-center">No feeds added yet.<br/>Click + to add one.</div>
          ) : feeds.map((f) => (
            <div
              key={f.id}
              onClick={() => setSelectedFeed(f.id === selectedFeed ? null : f.id)}
              className={`flex items-center gap-2 px-4 py-2 cursor-pointer hover:bg-muted/50 border-b border-border/50 ${f.id === selectedFeed ? "bg-primary/10 border-l-2 border-l-primary" : ""}`}
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{f.name}</div>
                <div className="text-xs text-muted-foreground truncate">{f.url}</div>
                {f.last_fetched && <div className="text-xs text-muted-foreground/60">Last: {formatDate(f.last_fetched)}</div>}
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); refreshFeed(f); }} className="p-1 rounded hover:bg-muted opacity-0 group-hover:opacity-100" title="Refresh">
                  <RefreshCw className="w-3 h-3" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); removeFeed.mutate(f.id); }} className="p-1 rounded hover:bg-destructive/20 text-destructive" title="Delete">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter rules panel */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 font-medium text-sm">
            <Filter className="w-4 h-4 text-primary" />
            Filter Rules {selectedFeed ? `(${feeds.find(f=>f.id===selectedFeed)?.name})` : "(All Feeds)"}
          </div>
          <button onClick={() => setAddFilterOpen(true)} className={`${btn} bg-primary/15 text-primary hover:bg-primary/25`}>
            <Plus className="w-3.5 h-3.5 inline mr-1" />Add Rule
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filters.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">No filter rules. Add one to auto-download matching torrents.</div>
          ) : (
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-card border-b border-border">
                <tr>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Rule Name</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Match Pattern</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Exclude</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Quality</th>
                  <th className="text-left px-4 py-2 text-muted-foreground font-medium">Save Path</th>
                  <th className="text-right px-4 py-2 text-muted-foreground font-medium w-16">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filters.map((r) => (
                  <tr key={r.id} className="border-b border-border/50 hover:bg-muted/30">
                    <td className="px-4 py-2 font-medium">{r.name}</td>
                    <td className="px-4 py-2 font-mono text-primary">{r.pattern}</td>
                    <td className="px-4 py-2 font-mono text-muted-foreground">{r.exclude_pattern ?? "—"}</td>
                    <td className="px-4 py-2">{r.quality_filter ?? "Any"}</td>
                    <td className="px-4 py-2 text-muted-foreground truncate max-w-32">{r.save_path ?? "Default"}</td>
                    <td className="px-4 py-2 text-right">
                      <button onClick={() => removeFilter.mutate(r.id)} className="p-1 rounded hover:bg-destructive/20 text-destructive">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Add Feed Dialog */}
      {addFeedOpen && <AddFeedDialog onClose={() => setAddFeedOpen(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ["rss-feeds"] }); setAddFeedOpen(false); }} />}
      {/* Add Filter Dialog */}
      {addFilterOpen && <AddFilterDialog feedId={selectedFeed} onClose={() => setAddFilterOpen(false)} onAdded={() => { qc.invalidateQueries({ queryKey: ["rss-filters"] }); setAddFilterOpen(false); }} />}
    </div>
  );
}

function AddFeedDialog({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [interval, setInterval] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) { setError("Name and URL are required"); return; }
    setLoading(true);
    try { await api.addFeed(name, url, interval); onAdded(); }
    catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-[440px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add RSS Feed</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground mb-1 block">Feed Name</label><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. RARBG" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">RSS URL</label><input className={inp} value={url} onChange={e => setUrl(e.target.value)} placeholder="https://..." /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Check interval (minutes)</label><input type="number" className={inp} value={interval} onChange={e => setInterval(Number(e.target.value))} /></div>
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className={`${btn} hover:bg-muted`}>Cancel</button>
          <button onClick={handleAdd} disabled={loading} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}>
            {loading ? "Adding..." : "Add Feed"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AddFilterDialog({ feedId, onClose, onAdded }: { feedId: string | null; onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [pattern, setPattern] = useState("");
  const [exclude, setExclude] = useState("");
  const [quality, setQuality] = useState("");
  const [savePath, setSavePath] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleAdd = async () => {
    if (!name.trim() || !pattern.trim()) { setError("Name and pattern are required"); return; }
    setLoading(true);
    try {
      await api.addFilterRule(feedId ?? undefined, name, pattern, exclude || undefined, undefined, undefined, savePath || undefined, undefined, undefined, quality || undefined);
      onAdded();
    } catch (e) { setError(String(e)); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-[480px] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">Add Filter Rule</h3>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="space-y-3">
          <div><label className="text-xs text-muted-foreground mb-1 block">Rule Name</label><input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="e.g. My Show 1080p" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Match Pattern (regex)</label><input className={inp} value={pattern} onChange={e => setPattern(e.target.value)} placeholder="My.Show.S\d+E\d+" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Exclude Pattern (optional)</label><input className={inp} value={exclude} onChange={e => setExclude(e.target.value)} placeholder="HDTV|WEB-DL" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Quality filter (optional)</label><input className={inp} value={quality} onChange={e => setQuality(e.target.value)} placeholder="1080p" /></div>
          <div><label className="text-xs text-muted-foreground mb-1 block">Save path (optional, default if empty)</label><input className={inp} value={savePath} onChange={e => setSavePath(e.target.value)} placeholder="C:\Downloads\Shows" /></div>
          {error && <div className="text-xs text-destructive">{error}</div>}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <button onClick={onClose} className={`${btn} hover:bg-muted`}>Cancel</button>
          <button onClick={handleAdd} disabled={loading} className={`${btn} bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50`}>
            {loading ? "Adding..." : "Add Rule"}
          </button>
        </div>
      </div>
    </div>
  );
}
