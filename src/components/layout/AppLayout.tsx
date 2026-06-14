import { useState } from "react";
import Sidebar from "./Sidebar";
import Toolbar from "./Toolbar";
import StatusBar from "./StatusBar";
import TorrentList from "../torrent/TorrentList";
import TorrentDetails from "../torrent/TorrentDetails";
import AddTorrentDialog from "../torrent/AddTorrentDialog";
import SettingsDialog from "../settings/SettingsDialog";
import StreamPlayerModal from "../streaming/StreamPlayerModal";
import RSSManager from "../rss/RSSManager";
import { useTorrentStore } from "../../stores/torrentStore";
import { useSettingsStore } from "../../stores/settingsStore";

export default function AppLayout() {
  const selectedIds = useTorrentStore((s) => s.selectedIds);
  const torrents = useTorrentStore((s) => s.torrents);
  const settingsOpen = useSettingsStore((s) => s.settingsOpen);
  const setSettingsOpen = useSettingsStore((s) => s.setSettingsOpen);

  const [addOpen, setAddOpen] = useState(false);
  const [detailsHeight, setDetailsHeight] = useState(280);
  const [sidebarWidth, setSidebarWidth] = useState(200);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [streamTitle, setStreamTitle] = useState("");
  const [activeView, setActiveView] = useState<"torrents" | "rss">("torrents");

  const selectedList = [...selectedIds];
  const selectedTorrent = selectedList.length === 1
    ? torrents.find((t) => t.record.id === selectedList[0]) ?? null
    : null;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden select-none"
         style={{ background: "hsl(0 0% 4%)", color: "hsl(0 0% 92%)" }}>
      {/* Toolbar */}
      <Toolbar onAddTorrent={() => setAddOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />

      {/* Main area */}
      <div className="flex flex-1 min-h-0">
        {/* Sidebar */}
        <div style={{ width: sidebarWidth, flexShrink: 0, borderRight: "1px solid rgba(255,255,255,0.07)" }}
             className="flex flex-col">
          <Sidebar onNavigate={setActiveView} activeView={activeView} />
        </div>

        {/* Resize handle */}
        <div
          className="panel-divider"
          style={{ width: 4, cursor: "col-resize" }}
          onMouseDown={(e) => {
            const startX = e.clientX;
            const startW = sidebarWidth;
            const onMove = (ev: MouseEvent) => {
              setSidebarWidth(Math.max(150, Math.min(350, startW + ev.clientX - startX)));
            };
            const onUp = () => {
              document.removeEventListener("mousemove", onMove);
              document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
          }}
        />

        {/* Content */}
        <div className="flex flex-col flex-1 min-w-0">
          {activeView === "rss" ? (
            <RSSManager />
          ) : (
            <>
              {/* Torrent list */}
              <div
                className="flex-1 min-h-0"
                style={{ height: `calc(100% - ${selectedTorrent ? detailsHeight + 4 : 0}px)` }}
              >
                <TorrentList onStream={(url, title) => { setStreamUrl(url); setStreamTitle(title); }} />
              </div>

              {/* Details panel */}
              {selectedTorrent && (
                <>
                  <div
                    className="panel-divider cursor-row-resize"
                    style={{ height: 4, width: "100%" }}
                    onMouseDown={(e) => {
                      const startY = e.clientY;
                      const startH = detailsHeight;
                      const onMove = (ev: MouseEvent) => {
                        setDetailsHeight(Math.max(140, Math.min(600, startH - (ev.clientY - startY))));
                      };
                      const onUp = () => {
                        document.removeEventListener("mousemove", onMove);
                        document.removeEventListener("mouseup", onUp);
                      };
                      document.addEventListener("mousemove", onMove);
                      document.addEventListener("mouseup", onUp);
                    }}
                  />
                  <div style={{ height: detailsHeight, flexShrink: 0, borderTop: "1px solid rgba(255,255,255,0.07)" }}>
                    <TorrentDetails torrent={selectedTorrent} />
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status bar */}
      <StatusBar />

      {/* Dialogs */}
      <AddTorrentDialog open={addOpen} onClose={() => setAddOpen(false)} />
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {streamUrl && (
        <StreamPlayerModal
          url={streamUrl}
          title={streamTitle}
          onClose={() => setStreamUrl(null)}
        />
      )}
    </div>
  );
}
