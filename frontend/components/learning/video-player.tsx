"use client";

import { Maximize, Minimize } from "lucide-react";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import { formatClock } from "@/lib/learning";
import { cn } from "@/lib/utils";
import type { SignedMedia } from "@/types/api";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2];
const WATERMARK_SPOTS = [
  "top-[8%] left-[6%]",
  "top-[8%] right-[6%]",
  "bottom-[22%] left-[8%]",
  "bottom-[22%] right-[8%]",
  "top-[45%] left-1/2 -translate-x-1/2",
];

export interface VideoPlayerHandle {
  seek: (seconds: number) => void;
  currentTime: () => number;
  /** Position + seconds watched since the last call (resets the counter). */
  takeProgress: () => { positionSeconds: number; watchedDelta: number };
}

interface Props {
  lessonId: string;
  media: SignedMedia;
  startAt?: number;
  watermark: string;
}

/**
 * Plain MP4/WebM player for signed R2 URLs (10-minute lifetime). When the URL
 * expires mid-lesson the browser's next range request fails; we fetch a new URL
 * and continue from the same time. A faint, moving watermark with the student's
 * email stays on top, including in full screen (the container goes full screen,
 * not the <video>).
 */
export const VideoPlayer = forwardRef<VideoPlayerHandle, Props>(function VideoPlayer(
  { lessonId, media, startAt = 0, watermark },
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [src, setSrc] = useState(media.url);
  const [speed, setSpeed] = useState(1);
  const [spot, setSpot] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const watched = useRef(0);
  const lastTime = useRef<number | null>(null);
  const resumeAt = useRef(startAt);
  const resumePlaying = useRef(false);
  const refreshing = useRef(false);

  useImperativeHandle(ref, () => ({
    seek: (seconds) => {
      const v = videoRef.current;
      if (!v) return;
      v.currentTime = seconds;
      void v.play().catch(() => {});
      containerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    currentTime: () => videoRef.current?.currentTime ?? 0,
    takeProgress: () => {
      const delta = watched.current;
      watched.current = 0;
      return { positionSeconds: videoRef.current?.currentTime ?? 0, watchedDelta: delta };
    },
  }));

  // Move the watermark every 15 s so it cannot simply be cropped out.
  useEffect(() => {
    const timer = setInterval(() => setSpot((s) => (s + 1) % WATERMARK_SPOTS.length), 15_000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const onChange = () => setFullscreen(document.fullscreenElement === containerRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const refreshUrl = useCallback(async () => {
    const v = videoRef.current;
    if (!v || refreshing.current) return;
    refreshing.current = true;
    resumeAt.current = v.currentTime;
    resumePlaying.current = !v.paused;
    toast.message(t.learning.player.refreshing);
    try {
      const fresh = await api<SignedMedia>(`/learn/lessons/${lessonId}/video-url`);
      setSrc(fresh.url);
    } finally {
      refreshing.current = false;
    }
  }, [lessonId]);

  const onLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = speed;
    const at = resumeAt.current;
    if (at > 5 && at < v.duration - 5) {
      v.currentTime = at;
      if (at === startAt) toast.message(t.learning.player.resumed(formatClock(at)));
    }
    if (resumePlaying.current) void v.play().catch(() => {});
    resumePlaying.current = false;
    lastTime.current = v.currentTime;
  };

  // Count only time that was actually played (not seeks).
  const onTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;
    const prev = lastTime.current;
    if (prev !== null && !v.seeking && !v.paused) {
      const diff = v.currentTime - prev;
      if (diff > 0 && diff < 3) watched.current += diff;
    }
    lastTime.current = v.currentTime;
  };

  const changeSpeed = (value: number) => {
    setSpeed(value);
    if (videoRef.current) videoRef.current.playbackRate = value;
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void containerRef.current?.requestFullscreen();
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden rounded-xl border bg-black select-none",
          fullscreen && "flex items-center rounded-none border-0",
        )}
        onContextMenu={(e) => e.preventDefault()}
      >
        <video
          ref={videoRef}
          src={src}
          className="aspect-video w-full"
          controls
          playsInline
          preload="metadata"
          controlsList="nodownload nofullscreen noremoteplayback noplaybackrate"
          disablePictureInPicture
          onLoadedMetadata={onLoadedMetadata}
          onTimeUpdate={onTimeUpdate}
          onSeeked={() => (lastTime.current = videoRef.current?.currentTime ?? null)}
          onError={() => void refreshUrl()}
        />
        <span
          aria-hidden
          className={cn(
            "pointer-events-none absolute text-xs font-medium text-white/25 transition-all duration-1000 sm:text-sm",
            WATERMARK_SPOTS[spot],
          )}
        >
          {watermark}
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1" role="group" aria-label={t.learning.player.speed}>
          <span className="text-muted-foreground mr-1 text-xs">{t.learning.player.speed}</span>
          {SPEEDS.map((s) => (
            <Button
              key={s}
              size="xs"
              variant={s === speed ? "secondary" : "ghost"}
              aria-pressed={s === speed}
              onClick={() => changeSpeed(s)}
            >
              {s}×
            </Button>
          ))}
        </div>
        <Button size="sm" variant="ghost" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize /> : <Maximize />}
          {fullscreen ? t.learning.player.exitFullscreen : t.learning.player.fullscreen}
        </Button>
      </div>
    </div>
  );
});
