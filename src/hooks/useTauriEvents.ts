import { useEffect, useRef } from "react";
import { listen } from "@tauri-apps/api/event";
import { useTorrentStore } from "../stores/torrentStore";
import { useSettingsStore } from "../stores/settingsStore";
import type { TorrentProgress } from "../lib/types";

export function useTauriEvents() {
  // Get store action references outside the effect.
  // These are stable Zustand actions — we intentionally omit them from deps
  // to prevent the infinite re-render loop caused by selector re-creation.
  const updateProgressRef = useRef(useTorrentStore.getState().updateProgress);
  const fetchTorrentsRef  = useRef(useTorrentStore.getState().fetchTorrents);
  const refreshStatsRef   = useRef(useSettingsStore.getState().refreshStats);

  const unlistenRef = useRef<Array<() => void>>([]);

  useEffect(() => {
    const updateProgress = updateProgressRef.current;
    const fetchTorrents  = fetchTorrentsRef.current;
    const refreshStats   = refreshStatsRef.current;

    const setup = async () => {
      const u1 = await listen<TorrentProgress[]>("torrent:progress", (event) => {
        updateProgress(event.payload);
      });
      const u2 = await listen<{ id: string; name: string }>("torrent:completed", () => fetchTorrents());
      const u3 = await listen("torrent:added",   () => fetchTorrents());
      const u4 = await listen("torrent:removed",  () => fetchTorrents());
      const u5 = await listen("stats:global",     () => refreshStats());
      unlistenRef.current = [u1, u2, u3, u4, u5];
    };

    setup();
    fetchTorrents();
    refreshStats();

    const interval = setInterval(() => refreshStatsRef.current(), 5000);

    return () => {
      unlistenRef.current.forEach((u) => u());
      clearInterval(interval);
    };
  }, []); // [] intentional: setup once on mount, actions are stable via refs
}
