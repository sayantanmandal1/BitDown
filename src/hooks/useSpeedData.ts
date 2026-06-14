import { useQuery } from "@tanstack/react-query";
import * as api from "../lib/tauri-commands";

export function useSpeedHistory(torrentId: string | null, seconds = 300) {
  return useQuery({
    queryKey: ["speed-history", torrentId, seconds],
    queryFn: () => api.getSpeedHistory(torrentId, seconds),
    refetchInterval: 5000,
    select: (data) =>
      data.map((s) => ({
        ...s,
        time: new Date(s.timestamp * 1000).toLocaleTimeString(),
        down: s.download_speed,
        up: s.upload_speed,
      })),
  });
}
