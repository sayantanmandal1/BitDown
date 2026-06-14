import { useState } from "react";
import { useSettingsStore } from "../../stores/settingsStore";
import type { AppSettings } from "../../lib/types";
import { X, Save, FolderOpen } from "lucide-react";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

interface SettingsDialogProps { open: boolean; onClose: () => void; }

const tabs = ["Connection", "Bandwidth", "Downloads", "Privacy", "Streaming", "Webhooks", "Advanced"];

export default function SettingsDialog({ open, onClose }: SettingsDialogProps) {
  const { settings, saveSettings } = useSettingsStore();
  const [tab, setTab] = useState("Connection");
  const [form, setForm] = useState<AppSettings | null>(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;
  const s = form ?? settings;
  if (!s) return null;

  const update = (patch: Partial<AppSettings>) => setForm({ ...s, ...patch });

  const handleSave = async () => {
    setSaving(true);
    try { await saveSettings(s); onClose(); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-card border border-border rounded-lg shadow-2xl w-[720px] h-[520px] flex overflow-hidden">
        {/* Left sidebar */}
        <div className="w-44 bg-background border-r border-border flex flex-col py-2">
          <div className="px-4 py-3 font-semibold text-sm border-b border-border mb-2">Settings</div>
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm text-left transition-colors ${tab === t ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/50"}`}
            >
              {t}
            </button>
          ))}
          <div className="flex-1" />
        </div>

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          <div className="flex items-center justify-between px-5 py-3 border-b border-border">
            <h2 className="font-medium">{tab}</h2>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>

          <div className="flex-1 overflow-y-auto p-5">
            {tab === "Connection" && (
              <div className="space-y-4">
                <Field label="Listen Port">
                  <input type="number" value={s.listen_port} onChange={(e) => update({ listen_port: Number(e.target.value) })} className={inp} />
                </Field>
                <Field label="Max Connections (Global)">
                  <input type="number" value={s.max_connections_global} onChange={(e) => update({ max_connections_global: Number(e.target.value) })} className={inp} />
                </Field>
                <Field label="Max Connections Per Torrent">
                  <input type="number" value={s.max_connections_per_torrent} onChange={(e) => update({ max_connections_per_torrent: Number(e.target.value) })} className={inp} />
                </Field>
                <Field label="Encryption">
                  <select value={s.encryption_mode} onChange={(e) => update({ encryption_mode: e.target.value })} className={inp}>
                    <option value="prefer">Prefer Encrypted</option>
                    <option value="force">Force Encrypted</option>
                    <option value="disable">Disabled</option>
                  </select>
                </Field>
                <div className="flex flex-wrap gap-6">
                  {[
                    { key: "enable_dht", label: "DHT" },
                    { key: "enable_pex", label: "PEX" },
                    { key: "enable_lsd", label: "Local Peer Discovery" },
                    { key: "upnp_enabled", label: "UPnP" },
                    { key: "natpmp_enabled", label: "NAT-PMP" },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 text-sm cursor-pointer">
                      <input type="checkbox" checked={(s as any)[key]} onChange={(e) => update({ [key]: e.target.checked } as any)} className="rounded" />
                      {label}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {tab === "Bandwidth" && (
              <div className="space-y-4">
                <Field label="Max Download Speed (0 = unlimited, KB/s)">
                  <input type="number" value={Math.floor(s.max_download_speed / 1024)} onChange={(e) => update({ max_download_speed: Number(e.target.value) * 1024 })} className={inp} />
                </Field>
                <Field label="Max Upload Speed (KB/s)">
                  <input type="number" value={Math.floor(s.max_upload_speed / 1024)} onChange={(e) => update({ max_upload_speed: Number(e.target.value) * 1024 })} className={inp} />
                </Field>
                <Field label="Disk Cache (MB)">
                  <input type="number" value={s.disk_cache_mb} onChange={(e) => update({ disk_cache_mb: Number(e.target.value) })} className={inp} />
                </Field>
              </div>
            )}

            {tab === "Downloads" && (
              <div className="space-y-4">
                <Field label="Default Download Path">
                  <div className="flex gap-2">
                    <input type="text" value={s.default_download_path} onChange={(e) => update({ default_download_path: e.target.value })} className={`${inp} flex-1`} />
                    <button onClick={async () => { const p = await openDialog({ directory: true }); if (typeof p === "string") update({ default_download_path: p }); }} className="px-3 rounded border border-border hover:bg-muted">
                      <FolderOpen className="w-4 h-4" />
                    </button>
                  </div>
                </Field>
                <Field label="Seed Ratio Limit (0 = no limit)">
                  <input type="number" step="0.1" value={s.seed_ratio_limit} onChange={(e) => update({ seed_ratio_limit: Number(e.target.value) })} className={inp} />
                </Field>
                <Field label="When Complete">
                  <select value={s.completed_action} onChange={(e) => update({ completed_action: e.target.value })} className={inp}>
                    <option value="seed">Continue Seeding</option>
                    <option value="nothing">Do Nothing</option>
                    <option value="move">Move Files</option>
                  </select>
                </Field>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="notify_complete" checked={s.notify_on_complete} onChange={(e) => update({ notify_on_complete: e.target.checked })} className="rounded" />
                  <label htmlFor="notify_complete" className="text-sm">Notify on completion</label>
                </div>
              </div>
            )}

            {tab === "Streaming" && (
              <div className="space-y-4">
                <Field label="TMDB API Key">
                  <input type="text" value={s.tmdb_api_key} onChange={(e) => update({ tmdb_api_key: e.target.value })} className={inp} placeholder="Get free key at themoviedb.org" />
                </Field>
                <Field label="Auto-Organize Template">
                  <input type="text" value={s.auto_organize_template} onChange={(e) => update({ auto_organize_template: e.target.value })} className={inp} placeholder="{title} ({year})" />
                  <p className="text-xs text-muted-foreground mt-1">Variables: {"{title}"} {"{year}"} {"{media_type}"} {"{ext}"}</p>
                </Field>
                <Field label="Plex Server URL (optional)">
                  <input type="text" value={s.plex_url ?? ""} onChange={(e) => update({ plex_url: e.target.value || undefined })} className={inp} placeholder="http://localhost:32400" />
                </Field>
                <Field label="Jellyfin Server URL (optional)">
                  <input type="text" value={s.jellyfin_url ?? ""} onChange={(e) => update({ jellyfin_url: e.target.value || undefined })} className={inp} placeholder="http://localhost:8096" />
                </Field>
              </div>
            )}

            {tab === "Advanced" && (
              <div className="space-y-4">
                <Field label="Remote Control Port">
                  <input type="text" value="54322" readOnly className={`${inp} opacity-50`} />
                </Field>
                <Field label="Remote Token">
                  <input type="text" value={s.remote_token} readOnly className={`${inp} font-mono text-xs`} />
                </Field>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="minimize_tray" checked={s.minimize_to_tray} onChange={(e) => update({ minimize_to_tray: e.target.checked })} className="rounded" />
                  <label htmlFor="minimize_tray" className="text-sm">Minimize to system tray</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="remote_enabled" checked={s.remote_enabled} onChange={(e) => update({ remote_enabled: e.target.checked })} className="rounded" />
                  <label htmlFor="remote_enabled" className="text-sm">Enable remote control</label>
                </div>
              </div>
            )}

            {(tab === "Privacy" || tab === "Webhooks") && (
              <div className="text-sm text-muted-foreground">
                {tab === "Privacy" ? "Configure proxy and kill-switch settings in the Privacy section." : "Add webhooks to be notified on events."}
                <br />
                <span className="text-xs opacity-60">Coming in a future update via the Privacy panel.</span>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
            <button onClick={onClose} className="px-4 py-2 rounded border border-border hover:bg-muted text-sm transition-colors">Cancel</button>
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 rounded bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-medium disabled:opacity-50 flex items-center gap-1.5 transition-colors">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const inp = "w-full bg-muted/50 border border-border rounded px-3 py-1.5 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-colors";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}
