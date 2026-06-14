import { useSettingsStore } from "../../stores/settingsStore";
import { formatSpeed, formatBytes } from "../../lib/utils";
import { ArrowDown, ArrowUp, HardDrive, Radio, Wifi } from "lucide-react";

export default function StatusBar() {
  const globalStats = useSettingsStore((s) => s.globalStats);

  return (
    <div
      className="flex items-center gap-5 px-4 py-1 flex-shrink-0 text-[11px]"
      style={{
        borderTop: "1px solid rgba(255,255,255,0.06)",
        background: "rgba(255,255,255,0.02)",
        color: "rgba(255,255,255,0.4)",
      }}
    >
      <div className="flex items-center gap-1.5">
        <ArrowDown className="w-3 h-3" style={{ color: "rgba(100,170,255,0.7)" }} />
        <span className="speed-value" style={{ color: "rgba(130,190,255,0.85)" }}>
          {formatSpeed(globalStats?.download_speed ?? 0)}
        </span>
      </div>

      <div className="flex items-center gap-1.5">
        <ArrowUp className="w-3 h-3" style={{ color: "rgba(80,200,130,0.7)" }} />
        <span className="speed-value" style={{ color: "rgba(100,220,150,0.85)" }}>
          {formatSpeed(globalStats?.upload_speed ?? 0)}
        </span>
      </div>

      <div className="w-px h-3 bg-white/[0.08]" />

      <span>
        ↓ {globalStats?.num_downloading ?? 0} &nbsp;
        ↑ {globalStats?.num_seeding ?? 0} &nbsp;
        ⏸ {globalStats?.num_paused ?? 0}
      </span>

      <div className="flex-1" />

      <div className="flex items-center gap-1.5">
        <Radio className="w-3 h-3" />
        <span>DHT: {globalStats?.dht_nodes ?? 0}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <HardDrive className="w-3 h-3" />
        <span>{formatBytes(globalStats?.free_disk_bytes ?? 0)} free</span>
      </div>

      <div className="flex items-center gap-1.5">
        <Wifi className="w-3 h-3" />
        <span>:{globalStats?.listen_port ?? 6881}</span>
      </div>

      <span style={{ color: "rgba(255,255,255,0.2)" }}>
        v{globalStats?.version ?? "0.1.0"}
      </span>
    </div>
  );
}

