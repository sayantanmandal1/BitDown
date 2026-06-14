import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";
import { X, Volume2, VolumeX, Maximize2, Play, Pause } from "lucide-react";
import { cn } from "../../lib/utils";

interface StreamPlayerModalProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function StreamPlayerModal({ url, title, onClose }: StreamPlayerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimer = useRef<number>();

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const isHls = url.includes(".m3u8");

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 90,
      });
      hls.loadSource(url);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        video.play().catch(() => {});
      });
      return () => hls.destroy();
    } else {
      video.src = url;
      video.play().catch(() => {});
    }
  }, [url]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onDurationChange = () => setDuration(video.duration);
    video.addEventListener("play", onPlay);
    video.addEventListener("pause", onPause);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("durationchange", onDurationChange);
    return () => {
      video.removeEventListener("play", onPlay);
      video.removeEventListener("pause", onPause);
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("durationchange", onDurationChange);
    };
  }, []);

  const showControls = () => {
    setControlsVisible(true);
    clearTimeout(controlsTimer.current);
    controlsTimer.current = window.setTimeout(() => setControlsVisible(false), 3000);
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play();
    else v.pause();
  };

  const formatTime = (t: number) => {
    if (!isFinite(t)) return "—";
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90">
      <div className="relative w-full max-w-5xl aspect-video bg-black rounded-lg overflow-hidden shadow-2xl"
           onMouseMove={showControls}>
        {/* Video */}
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          onClick={togglePlay}
        />

        {/* Controls overlay */}
        <div className={cn(
          "absolute inset-0 flex flex-col justify-between transition-opacity duration-300 pointer-events-none",
          controlsVisible ? "opacity-100" : "opacity-0"
        )}>
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-auto">
            <span className="text-sm font-medium text-white truncate">{title}</span>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Bottom controls */}
          <div className="flex flex-col px-4 pb-4 pt-8 bg-gradient-to-t from-black/80 to-transparent pointer-events-auto">
            {/* Seek bar */}
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={(e) => {
                const v = videoRef.current;
                if (v) v.currentTime = Number(e.target.value);
              }}
              className="w-full h-1 mb-3 accent-violet-500 cursor-pointer"
            />

            <div className="flex items-center gap-3">
              {/* Play/Pause */}
              <button onClick={togglePlay} className="text-white hover:text-violet-400 transition-colors">
                {playing ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
              </button>

              {/* Volume */}
              <button
                onClick={() => {
                  const v = videoRef.current;
                  if (!v) return;
                  v.muted = !muted;
                  setMuted(!muted);
                }}
                className="text-white hover:text-violet-400 transition-colors"
              >
                {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>

              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = videoRef.current;
                  const vol = Number(e.target.value);
                  setVolume(vol);
                  if (v) { v.volume = vol; v.muted = vol === 0; }
                  setMuted(vol === 0);
                }}
                className="w-20 h-1 accent-violet-500"
              />

              {/* Time */}
              <span className="text-white/70 text-xs font-mono ml-1">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>

              <div className="flex-1" />

              {/* Fullscreen */}
              <button
                onClick={() => videoRef.current?.requestFullscreen()}
                className="text-white hover:text-violet-400 transition-colors"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
