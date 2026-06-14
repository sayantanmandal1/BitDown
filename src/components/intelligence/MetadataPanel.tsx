import { useQuery } from "@tanstack/react-query";
import * as api from "../../lib/tauri-commands";
import type { TorrentSummary } from "../../lib/types";
import { Star } from "lucide-react";

export default function MetadataPanel({ torrent }: { torrent: TorrentSummary }) {
  const metaId = torrent.record.metadata_id;
  const { data: meta } = useQuery({
    queryKey: ["metadata", metaId],
    queryFn: () => metaId ? api.getCachedMetadata(metaId) : Promise.resolve(null),
    enabled: !!metaId,
  });

  if (!meta) return null;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Poster */}
      {meta.poster_url && (
        <div className="flex-shrink-0">
          <img
            src={meta.poster_url}
            alt={meta.title}
            className="w-full object-cover"
            style={{ maxHeight: 200 }}
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        <div className="text-xs font-semibold leading-tight">{meta.title}</div>
        {meta.year && <div className="text-xs text-muted-foreground">{meta.year}</div>}

        {meta.rating && (
          <div className="flex items-center gap-1">
            <Star className="w-3 h-3 text-yellow-400 fill-yellow-400" />
            <span className="text-xs text-yellow-400">{meta.rating.toFixed(1)}</span>
          </div>
        )}

        {meta.genres.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {meta.genres.slice(0, 3).map((g) => (
              <span key={g} className="px-1 py-0.5 rounded text-[10px] bg-muted text-muted-foreground">
                {g}
              </span>
            ))}
          </div>
        )}

        {meta.overview && (
          <p className="text-[10px] text-muted-foreground leading-relaxed line-clamp-6 mt-1">
            {meta.overview}
          </p>
        )}
      </div>
    </div>
  );
}
