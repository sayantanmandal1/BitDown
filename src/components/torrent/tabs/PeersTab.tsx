import { useQuery } from "@tanstack/react-query";
import * as api from "../../../lib/tauri-commands";
import { formatSpeed, formatProgress } from "../../../lib/utils";

export default function PeersTab({ torrentId }: { torrentId: string }) {
  const { data: peers = [] } = useQuery({
    queryKey: ["peers", torrentId],
    queryFn: () => api.getTorrentPeers(torrentId),
    refetchInterval: 3000,
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Address</th>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Client</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">↓ Speed</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">↑ Speed</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-20">Progress</th>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium w-24">Flags</th>
          </tr>
        </thead>
        <tbody>
          {peers.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                No peers connected
              </td>
            </tr>
          ) : peers.map((p, i) => (
            <tr key={i} className="border-b border-border/50 hover:bg-muted/30">
              <td className="px-3 py-1.5 font-mono">{p.addr}</td>
              <td className="px-3 py-1.5 text-muted-foreground">{p.client ?? "—"}</td>
              <td className="px-3 py-1.5 text-right text-blue-400 font-mono">
                {p.download_speed > 0 ? formatSpeed(p.download_speed) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right text-green-400 font-mono">
                {p.upload_speed > 0 ? formatSpeed(p.upload_speed) : "—"}
              </td>
              <td className="px-3 py-1.5 text-right font-mono">{formatProgress(p.progress)}</td>
              <td className="px-3 py-1.5 text-muted-foreground font-mono text-[10px]">{p.flags || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
