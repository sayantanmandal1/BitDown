import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { useSpeedHistory } from "../../../hooks/useSpeedData";
import { formatSpeed } from "../../../lib/utils";

export default function SpeedTab({ torrentId }: { torrentId: string }) {
  const { data: history = [] } = useSpeedHistory(torrentId, 300);

  return (
    <div className="h-full p-3 flex flex-col">
      <div className="text-xs text-muted-foreground mb-2">Last 5 minutes</div>
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={history} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorDown" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorUp" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: "#71717a" }}
              interval="preserveStartEnd"
            />
            <YAxis
              tickFormatter={(v) => formatSpeed(v)}
              tick={{ fontSize: 10, fill: "#71717a" }}
              width={70}
            />
            <Tooltip
              contentStyle={{ background: "#18181b", border: "1px solid #27272a", borderRadius: 6 }}
              labelStyle={{ color: "#a1a1aa" }}
              formatter={(v: number, name: string) => [formatSpeed(v), name === "down" ? "Download" : "Upload"]}
            />
            <Legend formatter={(v) => v === "down" ? "Download" : "Upload"} />
            <Area type="monotone" dataKey="down" stroke="#3b82f6" fill="url(#colorDown)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="up" stroke="#22c55e" fill="url(#colorUp)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
