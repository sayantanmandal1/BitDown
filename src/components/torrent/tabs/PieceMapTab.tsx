import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import * as api from "../../../lib/tauri-commands";

export default function PieceMapTab({ torrentId }: { torrentId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const { data: pieces = [] } = useQuery({
    queryKey: ["pieces", torrentId],
    queryFn: () => api.getTorrentPieceMap(torrentId),
    refetchInterval: 2000,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || pieces.length === 0) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const total = pieces.length;
    const pieceW = Math.max(1, W / total);

    ctx.clearRect(0, 0, W, H);

    for (let i = 0; i < total; i++) {
      const x = Math.floor(i * pieceW);
      const w = Math.ceil(pieceW);
      ctx.fillStyle = pieces[i] ? "#22c55e" : "#27272a";
      ctx.fillRect(x, 0, w, H);
    }
  }, [pieces]);

  const pct = pieces.length > 0
    ? ((pieces.filter(Boolean).length / pieces.length) * 100).toFixed(1)
    : "0.0";

  return (
    <div className="p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>Pieces: {pieces.filter(Boolean).length} / {pieces.length}</span>
        <span>{pct}% complete</span>
      </div>
      <canvas
        ref={canvasRef}
        width={600}
        height={24}
        className="piece-canvas w-full"
        style={{ height: 24 }}
      />
      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>Downloaded</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-zinc-700" />
          <span>Missing</span>
        </div>
      </div>
    </div>
  );
}
