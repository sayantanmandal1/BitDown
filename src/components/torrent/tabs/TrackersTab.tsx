import { useQuery } from "@tanstack/react-query";
import * as api from "../../../lib/tauri-commands";

export default function TrackersTab({ torrentId }: { torrentId: string }) {
  const { data: trackers = [] } = useQuery({
    queryKey: ["trackers", torrentId],
    queryFn: () => api.getTorrentTrackers(torrentId),
    refetchInterval: 10000,
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium">URL</th>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium w-32">Status</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-20">Peers</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-20">Seeds</th>
          </tr>
        </thead>
        <tbody>
          {trackers.length === 0 ? (
            <tr><td colSpan={4} className="px-3 py-8 text-center text-muted-foreground">No trackers</td></tr>
          ) : trackers.map((t, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
              <td className="px-3 py-1.5 font-mono truncate max-w-xs" title={t.url}>{t.url}</td>
              <td className="px-3 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  t.status.includes("Error") ? "bg-red-500/15 text-red-400" :
                  t.status.includes("Live") ? "bg-green-500/15 text-green-400" :
                  "bg-zinc-500/15 text-zinc-400"
                }`}>
                  {t.status}
                </span>
              </td>
              <td className="px-3 py-1.5 text-right text-blue-400 font-mono">{t.peers}</td>
              <td className="px-3 py-1.5 text-right text-green-400 font-mono">{t.seeds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
