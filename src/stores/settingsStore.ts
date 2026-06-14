import { create } from "zustand";
import type { AppSettings, GlobalStats } from "../lib/types";
import * as api from "../lib/tauri-commands";

interface SettingsStore {
  settings: AppSettings | null;
  globalStats: GlobalStats | null;
  settingsOpen: boolean;

  loadSettings: () => Promise<void>;
  saveSettings: (s: AppSettings) => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
  refreshStats: () => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  settings: null,
  globalStats: null,
  settingsOpen: false,

  loadSettings: async () => {
    try {
      const settings = await api.getSettings();
      set({ settings });
    } catch (e) {
      console.error("Failed to load settings", e);
    }
  },

  saveSettings: async (settings) => {
    await api.saveSettings(settings);
    set({ settings });
  },

  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),

  refreshStats: async () => {
    try {
      const globalStats = await api.getGlobalStats();
      set({ globalStats });
    } catch (e) {
      // ignore
    }
  },
}));
