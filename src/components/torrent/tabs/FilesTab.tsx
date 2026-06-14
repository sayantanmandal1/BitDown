import { useQuery } from "@tanstack/react-query";
import * as api from "../../../lib/tauri-commands";
import { formatBytes, formatProgress } from "../../../lib/utils";
import { File, Film, Music, Book } from "lucide-react";

function fileIcon(name: string) {
  if (/\.(mp4|mkv|avi|mov|webm)/i.test(name)) return <Film className="w-3.5 h-3.5 text-blue-400" />;
  if (/\.(mp3|flac|aac|wav|ogg)/i.test(name)) return <Music className="w-3.5 h-3.5 text-green-400" />;
  if (/\.(pdf|epub|mobi)/i.test(name)) return <Book className="w-3.5 h-3.5 text-yellow-400" />;
  return <File className="w-3.5 h-3.5 text-muted-foreground" />;
}

export default function FilesTab({ torrentId }: { torrentId: string }) {
  const { data: files = [] } = useQuery({
    queryKey: ["files", torrentId],
    queryFn: () => api.getTorrentFiles(torrentId),
    refetchInterval: 5000,
  });

  return (
    <div className="h-full overflow-auto">
      <table className="w-full text-xs">
        <thead className="sticky top-0 bg-card border-b border-border">
          <tr>
            <th className="text-left px-3 py-2 text-muted-foreground font-medium">Name</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Size</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Done</th>
            <th className="text-right px-3 py-2 text-muted-foreground font-medium w-24">Progress</th>
            <th className="text-center px-3 py-2 text-muted-foreground font-medium w-20">Priority</th>
          </tr>
        </thead>
        <tbody>
          {files.map((f) => (
            <tr key={f.index} className="border-b border-border/50 hover:bg-muted/30">
              <td className="px-3 py-1.5 flex items-center gap-2">
                {fileIcon(f.path)}
                <span className="truncate max-w-xs" title={f.path}>{f.path}</span>
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {formatBytes(f.size)}
              </td>
              <td className="px-3 py-1.5 text-right font-mono text-muted-foreground">
                {formatBytes(f.downloaded)}
              </td>
              <td className="px-3 py-1.5 text-right">
                <div className="flex items-center gap-1.5 justify-end">
                  <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full"
                      style={{ width: `${Math.min(100, f.progress * 100)}%` }}
                    />
                  </div>
                  <span className="font-mono w-10 text-right">{formatProgress(f.progress)}</span>
                </div>
              </td>
              <td className="px-3 py-1.5 text-center">
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${f.wanted ? "bg-green-500/15 text-green-400" : "bg-zinc-500/15 text-zinc-400"}`}>
                  {f.wanted ? "Normal" : "Skip"}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
