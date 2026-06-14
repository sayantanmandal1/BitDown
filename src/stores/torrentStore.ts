import { create } from "zustand";
import { useShallow } from "zustand/react/shallow";
import type { TorrentSummary, TorrentProgress, SidebarFilter } from "../lib/types";
import * as api from "../lib/tauri-commands";

interface TorrentStore {
  torrents: TorrentSummary[];
  selectedIds: Set<string>;
  activeFilter: SidebarFilter;
  searchQuery: string;
  sortKey: string;
  sortAsc: boolean;

  // Actions
  setTorrents: (t: TorrentSummary[]) => void;
  updateProgress: (updates: TorrentProgress[]) => void;
  setSelectedIds: (ids: Set<string>) => void;
  toggleSelected: (id: string) => void;
  setActiveFilter: (f: SidebarFilter) => void;
  setSearchQuery: (q: string) => void;
  setSortKey: (k: string) => void;
  setSortAsc: (a: boolean) => void;

  fetchTorrents: () => Promise<void>;
  pauseSelected: () => Promise<void>;
  resumeSelected: () => Promise<void>;
  removeSelected: (deleteFiles: boolean) => Promise<void>;
}

export const useTorrentStore = create<TorrentStore>((set, get) => ({
  torrents: [],
  selectedIds: new Set(),
  activeFilter: "all",
  searchQuery: "",
  sortKey: "added_at",
  sortAsc: false,

  setTorrents: (torrents) => set({ torrents }),

  updateProgress: (updates) =>
    set((state) => {
      const map = new Map(updates.map((u) => [u.id, u]));
      return {
        torrents: state.torrents.map((t) => {
          const live = map.get(t.record.id);
          if (!live) return t;
          return { ...t, live, record: { ...t.record, status: live.status } };
        }),
      };
    }),

  setSelectedIds: (selectedIds) => set({ selectedIds }),
  toggleSelected: (id) =>
    set((state) => {
      const next = new Set(state.selectedIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedIds: next };
    }),
  setActiveFilter: (activeFilter) => set({ activeFilter, selectedIds: new Set() }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setSortKey: (sortKey) => set({ sortKey }),
  setSortAsc: (sortAsc) => set({ sortAsc }),

  fetchTorrents: async () => {
    try {
      const torrents = await api.getAllTorrents();
      set({ torrents });
    } catch (e) {
      console.error("Failed to fetch torrents", e);
    }
  },

  pauseSelected: async () => {
    const { selectedIds } = get();
    await Promise.all([...selectedIds].map((id) => api.pauseTorrent(id)));
    get().fetchTorrents();
  },

  resumeSelected: async () => {
    const { selectedIds } = get();
    await Promise.all([...selectedIds].map((id) => api.resumeTorrent(id)));
    get().fetchTorrents();
  },

  removeSelected: async (deleteFiles) => {
    const { selectedIds } = get();
    await Promise.all([...selectedIds].map((id) => api.removeTorrent(id, deleteFiles)));
    set({ selectedIds: new Set() });
    get().fetchTorrents();
  },
}));

// Derived selector: filtered + sorted torrent list
// Uses shallow equality to prevent infinite re-render loops when the
// sorted array is a new reference but contains the same items.
export function useFilteredTorrents(): TorrentSummary[] {
  return useTorrentStore(useShallow((state): TorrentSummary[] => {
    let list = state.torrents;
    const filter = state.activeFilter;
    if (filter !== "all") {
      if (filter.startsWith("label:")) {
        const label = filter.slice(6);
        list = list.filter((t) => t.record.label === label);
      } else if (filter.startsWith("category:")) {
        const cat = filter.slice(9);
        list = list.filter((t) => t.record.category === cat);
      } else {
        list = list.filter((t) => {
          const s = t.record.status;
          if (filter === "completed") return s === "seeding" || (t.live?.progress ?? 0) >= 1;
          return s === filter;
        });
      }
    }
    const q = state.searchQuery.toLowerCase();
    if (q) list = list.filter((t) => t.record.name.toLowerCase().includes(q));
    const { sortKey, sortAsc } = state;
    return [...list].sort((a, b) => {
      let av: number | string = 0, bv: number | string = 0;
      switch (sortKey) {
        case "name": av = a.record.name; bv = b.record.name; break;
        case "size": av = a.record.total_size; bv = b.record.total_size; break;
        case "progress": av = a.live?.progress ?? 0; bv = b.live?.progress ?? 0; break;
        case "download_speed": av = a.live?.download_speed ?? 0; bv = b.live?.download_speed ?? 0; break;
        case "upload_speed": av = a.live?.upload_speed ?? 0; bv = b.live?.upload_speed ?? 0; break;
        case "eta": av = a.live?.eta_seconds ?? Infinity; bv = b.live?.eta_seconds ?? Infinity; break;
        case "seeds": av = a.live?.num_seeders ?? 0; bv = b.live?.num_seeders ?? 0; break;
        default: av = a.record.added_at; bv = b.record.added_at;
      }
      if (typeof av === "string") return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
      return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }));
}
