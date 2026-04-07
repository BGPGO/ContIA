"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Maximize,
} from "lucide-react";
import type { TranscriptionSegment, VideoCut, LogoPosition } from "@/types/video";

interface VideoPlayerProps {
  src: string;
  subtitles?: TranscriptionSegment[];
  showSubtitles?: boolean;
  logo?: string;
  logoPosition?: LogoPosition;
  cuts?: VideoCut[];
  onTimeUpdate?: (time: number) => void;
  activeCut?: VideoCut | null;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

const speedOptions = [0.5, 1, 1.5, 2];

export function VideoPlayer({
  src,
  subtitles = [],
  showSubtitles = true,
  logo,
  logoPosition = "bottom-right",
  cuts = [],
  onTimeUpdate,
  activeCut,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [currentSubtitle, setCurrentSubtitle] = useState("");
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setPlaying(true);
    } else {
      v.pause();
      setPlaying(false);
    }
  }, []);

  const skip = useCallback((delta: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(v.duration, v.currentTime + delta));
  }, []);

  const seekTo = useCallback((time: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = time;
  }, []);

  // Seek to active cut start
  useEffect(() => {
    if (activeCut) {
      seekTo(activeCut.startTime);
      videoRef.current?.play();
      setPlaying(true);
    }
  }, [activeCut, seekTo]);

  // Stop at active cut end
  useEffect(() => {
    if (activeCut && currentTime >= activeCut.endTime) {
      videoRef.current?.pause();
      setPlaying(false);
    }
  }, [activeCut, currentTime]);

  const handleTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
    onTimeUpdate?.(v.currentTime);

    // Update subtitle
    if (showSubtitles && subtitles.length > 0) {
      const seg = subtitles.find(
        (s) => v.currentTime >= s.start && v.currentTime <= s.end
      );
      setCurrentSubtitle(seg?.text ?? "");
    } else {
      setCurrentSubtitle("");
    }
  }, [onTimeUpdate, subtitles, showSubtitles]);

  const handleProgressClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const bar = progressRef.current;
      const v = videoRef.current;
      if (!bar || !v) return;
      const rect = bar.getBoundingClientRect();
      const pct = (e.clientX - rect.left) / rect.width;
      v.currentTime = pct * v.duration;
    },
    []
  );

  const changeSpeed = useCallback(
    (s: number) => {
      const v = videoRef.current;
      if (v) v.playbackRate = s;
      setSpeed(s);
      setShowSpeedMenu(false);
    },
    []
  );

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      v.parentElement?.requestFullscreen();
    }
  }, []);

  const logoPositionClass: Record<LogoPosition, string> = {
    "top-left": "top-3 left-3",
    "top-right": "top-3 right-3",
    "bottom-left": "bottom-16 left-3",
    "bottom-right": "bottom-16 right-3",
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="relative w-full bg-black rounded-xl overflow-hidden group">
      {/* Video */}
      <video
        ref={videoRef}
        src={src}
        className="w-full aspect-video object-contain bg-black"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => {
          if (videoRef.current) setDuration(videoRef.current.duration);
        }}
        onEnded={() => setPlaying(false)}
        onClick={togglePlay}
        playsInline
      />

      {/* Subtitle overlay */}
      {showSubtitles && currentSubtitle && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 max-w-[80%] text-center pointer-events-none">
          <span className="inline-block px-4 py-2 rounded-lg bg-black/75 text-white text-sm md:text-base font-medium backdrop-blur-sm">
            {currentSubtitle}
          </span>
        </div>
      )}

      {/* Logo overlay */}
      {logo && (
        <div
          className={`absolute ${logoPositionClass[logoPosition]} pointer-events-none`}
        >
          <img
            src={logo}
            alt="Logo"
            className="w-10 h-10 md:w-12 md:h-12 rounded-lg opacity-80 object-contain"
          />
        </div>
      )}

      {/* Play button overlay (when paused) */}
      {!playing && (
        <button
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20">
            <Play className="w-7 h-7 text-white ml-1" />
          </div>
        </button>
      )}

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-3 pt-8 opacity-0 group-hover:opacity-100 transition-opacity">
        {/* Progress bar */}
        <div
          ref={progressRef}
          className="relative w-full h-1.5 bg-white/20 rounded-full cursor-pointer mb-3 group/progress"
          onClick={handleProgressClick}
        >
          {/* Cut markers */}
          {cuts.map((cut) => {
            const left = duration > 0 ? (cut.startTime / duration) * 100 : 0;
            const width =
              duration > 0
                ? ((cut.endTime - cut.startTime) / duration) * 100
                : 0;
            return (
              <div
                key={cut.id}
                className={`absolute top-0 h-full rounded-full ${
                  cut.accepted ? "bg-accent/50" : "bg-secondary/50"
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
              />
            );
          })}
          {/* Played progress */}
          <div
            className="absolute top-0 left-0 h-full bg-accent rounded-full transition-[width] duration-100"
            style={{ width: `${progressPct}%` }}
          />
          {/* Thumb */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-accent rounded-full shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity"
            style={{ left: `${progressPct}%`, marginLeft: "-6px" }}
          />
        </div>

        {/* Buttons row */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => skip(-5)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Voltar 5s"
          >
            <SkipBack className="w-4 h-4 text-white" />
          </button>
          <button
            onClick={togglePlay}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {playing ? (
              <Pause className="w-5 h-5 text-white" />
            ) : (
              <Play className="w-5 h-5 text-white" />
            )}
          </button>
          <button
            onClick={() => skip(5)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
            title="Avançar 5s"
          >
            <SkipForward className="w-4 h-4 text-white" />
          </button>

          <span className="text-xs text-white/70 font-mono ml-1">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Speed */}
          <div className="relative">
            <button
              onClick={() => setShowSpeedMenu((v) => !v)}
              className="px-2 py-1 text-xs font-medium text-white/80 hover:text-white bg-white/10 rounded-md hover:bg-white/15 transition-colors"
            >
              {speed}x
            </button>
            {showSpeedMenu && (
              <div className="absolute bottom-full right-0 mb-1 bg-bg-card border border-border rounded-lg overflow-hidden shadow-xl">
                {speedOptions.map((s) => (
                  <button
                    key={s}
                    onClick={() => changeSpeed(s)}
                    className={`block w-full px-4 py-1.5 text-xs text-left hover:bg-bg-card-hover transition-colors ${
                      s === speed
                        ? "text-accent font-medium"
                        : "text-text-secondary"
                    }`}
                  >
                    {s}x
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={toggleMute}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-white" />
            ) : (
              <Volume2 className="w-4 h-4 text-white" />
            )}
          </button>
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <Maximize className="w-4 h-4 text-white" />
          </button>
        </div>
      </div>
    </div>
  );
}
