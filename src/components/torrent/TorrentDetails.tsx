import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import type { TorrentSummary } from "../../lib/types";
import GeneralTab from "./tabs/GeneralTab";
import FilesTab from "./tabs/FilesTab";
import PeersTab from "./tabs/PeersTab";
import TrackersTab from "./tabs/TrackersTab";
import SpeedTab from "./tabs/SpeedTab";
import PieceMapTab from "./tabs/PieceMapTab";
import MetadataPanel from "../intelligence/MetadataPanel";

interface TorrentDetailsProps {
  torrent: TorrentSummary;
}

export default function TorrentDetails({ torrent }: TorrentDetailsProps) {
  const [tab, setTab] = useState("general");
  const hasMetadata = !!torrent.record.metadata_id;

  return (
    <div className="flex h-full bg-card">
      {/* Left: metadata panel */}
      {hasMetadata && (
        <div className="w-48 flex-shrink-0 border-r border-border overflow-hidden">
          <MetadataPanel torrent={torrent} />
        </div>
      )}

      {/* Right: tabs */}
      <div className="flex-1 min-w-0 flex flex-col">
        <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full">
          <TabsList className="rounded-none border-b border-border bg-transparent h-8 px-2 flex-shrink-0 justify-start gap-1">
            {["general", "files", "peers", "trackers", "speed", "pieces"].map((t) => (
              <TabsTrigger
                key={t}
                value={t}
                className="text-xs px-3 py-1 rounded data-[state=active]:bg-muted data-[state=active]:text-foreground"
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="flex-1 min-h-0 overflow-auto">
            <TabsContent value="general" className="m-0 h-full">
              <GeneralTab torrent={torrent} />
            </TabsContent>
            <TabsContent value="files" className="m-0 h-full">
              <FilesTab torrentId={torrent.record.id} />
            </TabsContent>
            <TabsContent value="peers" className="m-0 h-full">
              <PeersTab torrentId={torrent.record.id} />
            </TabsContent>
            <TabsContent value="trackers" className="m-0 h-full">
              <TrackersTab torrentId={torrent.record.id} />
            </TabsContent>
            <TabsContent value="speed" className="m-0 h-full">
              <SpeedTab torrentId={torrent.record.id} />
            </TabsContent>
            <TabsContent value="pieces" className="m-0 h-full">
              <PieceMapTab torrentId={torrent.record.id} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
