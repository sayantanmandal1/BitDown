import { useRef, useCallback, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useTorrentStore, useFilteredTorrents } from "../../stores/torrentStore";
import type { TorrentSummary } from "../../lib/types";
import {
  formatBytes, formatSpeed, formatEta, formatProgress, formatDate,
  formatDateShort, torrentStatusBg, torrentStatusColor, cn, isVideoFile,
} from "../../lib/utils";
import {
  Play, MoreHorizontal, ArrowUp, ArrowDown, ArrowUpDown,
} from "lucide-react";
import * as api from "../../lib/tauri-commands";
import { getStreamUrl } from "../../lib/tauri-commands";

// Inline progress bar component
function ProgressBar({ value, status }: { value: number; status: string }) {
  const fillClass =
    status === "downloading" ? "progress-fill-download" :
    status === "seeding"     ? "progress-fill-seed" :
    status === "checking"    ? "progress-fill-check" :
                               "progress-fill-pause";

  return (
    <div className="progress-track w-full mt-0.5">
      <div className={fillClass} style={{ width: `${Math.min(100, value * 100)}%`, transition: "width 0.5s" }} />
    </div>
  );
}

interface TorrentListProps {
  onStream: (url: string, title: string) => void;
}

export default function TorrentList({ onStream }: TorrentListProps) {
  const selectedIds   = useTorrentStore((s) => s.selectedIds);
  const setSelectedIds = useTorrentStore((s) => s.setSelectedIds);
  const toggleSelected = useTorrentStore((s) => s.toggleSelected);
  const setSortKey     = useTorrentStore((s) => s.setSortKey);
  const setSortAsc     = useTorrentStore((s) => s.setSortAsc);
  const sortKey        = useTorrentStore((s) => s.sortKey);
  const sortAsc        = useTorrentStore((s) => s.sortAsc);
  const filtered = useFilteredTorrents();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string } | null>(null);

  const columns: ColumnDef<TorrentSummary>[] = [
    {
      id: "name",
      header: "Name",
      size: 340,
      cell: ({ row }) => {
        const t = row.original;
        const hasVideo = t.record.name.match(/\.(mp4|mkv|avi|mov|webm)/i);
        return (
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex flex-col min-w-0 flex-1">
              <span className="truncate text-[13px] leading-tight">{t.record.name}</span>
              <div className="mt-0.5">
                <ProgressBar value={t.live?.progress ?? t.record.downloaded / Math.max(1, t.record.total_size)} status={t.record.status} />
              </div>
            </div>
            {hasVideo && (
              <button
                onClick={async (e) => {
                  e.stopPropagation();
                  try {
                    const url = await getStreamUrl(t.record.id, 0, true);
                    onStream(url, t.record.name);
                  } catch {}
                }}
                className="p-1 rounded hover:bg-primary/20 text-primary opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                title="Stream now"
              >
                <Play className="w-3 h-3" />
              </button>
            )}
          </div>
        );
      },
    },
    {
      id: "status",
      header: "Status",
      size: 100,
      cell: ({ row }) => {
        const s = row.original.record.status;
        return (
          <span className={cn("px-1.5 py-0.5 rounded text-[11px] font-medium border", torrentStatusBg(s))}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </span>
        );
      },
    },
    {
      id: "size",
      header: "Size",
      size: 80,
      accessorFn: (r) => r.record.total_size,
      cell: ({ row }) => (
        <span className="speed-value text-muted-foreground">
          {formatBytes(row.original.record.total_size)}
        </span>
      ),
    },
    {
      id: "progress",
      header: "%",
      size: 60,
      accessorFn: (r) => r.live?.progress ?? 0,
      cell: ({ row }) => {
        const p = row.original.live?.progress ?? row.original.record.downloaded / Math.max(1, row.original.record.total_size);
        return <span className="speed-value">{formatProgress(p)}</span>;
      },
    },
    {
      id: "seeds",
      header: "Seeds",
      size: 60,
      cell: ({ row }) => (
        <span className="speed-value text-green-400">{row.original.live?.num_seeders ?? 0}</span>
      ),
    },
    {
      id: "peers",
      header: "Peers",
      size: 60,
      cell: ({ row }) => (
        <span className="speed-value text-blue-400">{row.original.live?.num_peers ?? 0}</span>
      ),
    },
    {
      id: "download_speed",
      header: "↓ Speed",
      size: 90,
      accessorFn: (r) => r.live?.download_speed ?? 0,
      cell: ({ row }) => {
        const s = row.original.live?.download_speed ?? 0;
        return <span className="speed-value text-blue-400">{s > 0 ? formatSpeed(s) : "—"}</span>;
      },
    },
    {
      id: "upload_speed",
      header: "↑ Speed",
      size: 90,
      accessorFn: (r) => r.live?.upload_speed ?? 0,
      cell: ({ row }) => {
        const s = row.original.live?.upload_speed ?? 0;
        return <span className="speed-value text-green-400">{s > 0 ? formatSpeed(s) : "—"}</span>;
      },
    },
    {
      id: "eta",
      header: "ETA",
      size: 80,
      cell: ({ row }) => (
        <span className="speed-value text-muted-foreground">
          {row.original.record.status === "downloading" ? formatEta(row.original.live?.eta_seconds) : "—"}
        </span>
      ),
    },
    {
      id: "added_at",
      header: "Added",
      size: 100,
      cell: ({ row }) => (
        <span className="speed-value text-muted-foreground">
          {formatDateShort(row.original.record.added_at)}
        </span>
      ),
    },
    {
      id: "label",
      header: "Label",
      size: 80,
      cell: ({ row }) => {
        const label = row.original.record.label;
        return label ? (
          <span className="px-1.5 py-0.5 rounded text-[11px] bg-violet-500/15 text-violet-400 border border-violet-500/30">
            {label}
          </span>
        ) : null;
      },
    },
  ];

  const table = useReactTable({
    data: filtered,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getRowId: (row) => row.record.id,
  });

  const parentRef = useRef<HTMLDivElement>(null);
  const rows = table.getRowModel().rows;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 40,
    overscan: 5,
  });

  const handleRowClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        toggleSelected(id);
      } else if (e.shiftKey) {
        // range select
        const ids = filtered.map((t) => t.record.id);
        const lastSelected = [...selectedIds].pop();
        const from = ids.indexOf(lastSelected ?? id);
        const to = ids.indexOf(id);
        const range = ids.slice(Math.min(from, to), Math.max(from, to) + 1);
        setSelectedIds(new Set([...selectedIds, ...range]));
      } else {
        setSelectedIds(new Set([id]));
      }
    },
    [filtered, selectedIds, toggleSelected, setSelectedIds]
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex border-b border-border bg-card flex-shrink-0 text-xs text-muted-foreground">
        {table.getFlatHeaders().map((header) => (
          <div
            key={header.id}
            style={{ width: header.getSize(), flexShrink: 0 }}
            className={cn(
              "px-3 py-2 font-medium flex items-center gap-1 cursor-pointer hover:text-foreground select-none",
              header.id === "name" && "flex-1"
            )}
            onClick={() => {
              if (sortKey === header.id) setSortAsc(!sortAsc);
              else { setSortKey(header.id); setSortAsc(false); }
            }}
          >
            {flexRender(header.column.columnDef.header, header.getContext())}
            {sortKey === header.id ? (
              sortAsc ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />
            ) : null}
          </div>
        ))}
      </div>

      {/* Virtualized list */}
      <div ref={parentRef} className="flex-1 overflow-auto">
        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground gap-2">
            <div className="text-4xl opacity-20">⬇</div>
            <p className="text-sm">No torrents. Click Add to get started.</p>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
            {virtualizer.getVirtualItems().map((virtualRow) => {
              const row = rows[virtualRow.index];
              const t = row.original;
              const isSelected = selectedIds.has(t.record.id);
              return (
                <div
                  key={row.id}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  style={{ position: "absolute", top: virtualRow.start, width: "100%" }}
                  className={cn(
                    "flex items-center group torrent-row",
                    t.record.status,
                    isSelected && "selected"
                  )}
                  onClick={(e) => handleRowClick(t.record.id, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    if (!selectedIds.has(t.record.id)) setSelectedIds(new Set([t.record.id]));
                    setContextMenu({ x: e.clientX, y: e.clientY, id: t.record.id });
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <div
                      key={cell.id}
                      style={{ width: cell.column.getSize(), flexShrink: 0 }}
                      className={cn("px-3 py-2 text-sm overflow-hidden", cell.column.id === "name" && "flex-1")}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context menu */}
      {contextMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
          <div
            className="fixed z-50 bg-popover border border-border rounded shadow-xl py-1 min-w-48 text-sm"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            {[
              { label: "Resume", action: () => api.resumeTorrent(contextMenu.id) },
              { label: "Pause", action: () => api.pauseTorrent(contextMenu.id) },
              { label: "Force Recheck", action: () => api.forceRecheck(contextMenu.id) },
              { label: "Open Folder", action: () => api.openDownloadFolder(contextMenu.id) },
              { label: "Stream Now", action: async () => {
                const url = await getStreamUrl(contextMenu.id, 0, true);
                const t = filtered.find((x) => x.record.id === contextMenu.id);
                onStream(url, t?.record.name ?? "");
              }},
              null,
              { label: "Remove (keep files)", action: () => api.removeTorrent(contextMenu.id, false), red: false },
              { label: "Remove + delete files", action: () => api.removeTorrent(contextMenu.id, true), red: true },
            ].map((item, i) =>
              item === null ? (
                <div key={i} className="my-1 border-t border-border" />
              ) : (
                <button
                  key={item.label}
                  className={cn("w-full text-left px-4 py-1.5 hover:bg-muted", item.red && "text-destructive")}
                  onClick={() => { item.action(); setContextMenu(null); }}
                >
                  {item.label}
                </button>
              )
            )}
          </div>
        </>
      )}
    </div>
  );
}
