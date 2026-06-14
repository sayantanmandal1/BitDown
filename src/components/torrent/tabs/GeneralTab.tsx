import type { TorrentSummary } from "../../../lib/types";
import { formatBytes, formatSpeed, formatEta, formatProgress, formatDate, formatRatio } from "../../../lib/utils";

interface GeneralTabProps { torrent: TorrentSummary; }

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start py-1 border-b border-border/50 last:border-0">
      <span className="text-muted-foreground text-xs w-36 flex-shrink-0">{label}</span>
      <span className="text-xs font-mono">{value}</span>
    </div>
  );
}

export default function GeneralTab({ torrent }: GeneralTabProps) {
  const { record, live } = torrent;
  const progress = live?.progress ?? record.downloaded / Math.max(1, record.total_size);

  return (
    <div className="p-3 grid grid-cols-2 gap-x-8">
      <div>
        <Row label="Name" value={record.name} />
        <Row label="Info Hash" value={<span className="break-all">{record.info_hash}</span>} />
        <Row label="Save Path" value={record.save_path} />
        <Row label="Status" value={record.status} />
        <Row label="Size" value={formatBytes(record.total_size)} />
        <Row label="Downloaded" value={formatBytes(record.downloaded)} />
        <Row label="Uploaded" value={formatBytes(record.uploaded)} />
        <Row label="Ratio" value={formatRatio(record.downloaded, record.uploaded)} />
      </div>
      <div>
        <Row label="Progress" value={formatProgress(progress)} />
        <Row label="Download Speed" value={formatSpeed(live?.download_speed ?? 0)} />
        <Row label="Upload Speed" value={formatSpeed(live?.upload_speed ?? 0)} />
        <Row label="ETA" value={formatEta(live?.eta_seconds)} />
        <Row label="Peers" value={`${live?.num_peers ?? 0} connected, ${live?.num_seeders ?? 0} seeds`} />
        <Row label="Added" value={formatDate(record.added_at)} />
        {record.completed_at && <Row label="Completed" value={formatDate(record.completed_at)} />}
        <Row label="Category" value={record.category ?? "—"} />
        <Row label="Label" value={record.label ?? "—"} />
      </div>
    </div>
  );
}
