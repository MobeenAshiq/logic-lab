"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { api } from "@/lib/api/client";
import { t } from "@/lib/i18n";
import type { LessonProgress } from "@/types/api";

export const learningKeys = {
  lesson: (id: string) => ["learn", "lesson", id] as const,
  outline: (slug: string) => ["learn", "outline", slug] as const,
  questions: (id: string) => ["learn", "questions", id] as const,
  dashboard: ["student", "learning"] as const,
};

/** 75 → "1:15", 3725 → "1:02:05". */
export function formatClock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** 5400 → "1h 30m", 300 → "5m". */
export function formatDuration(totalSeconds: number) {
  const m = Math.round(totalSeconds / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${m % 60}m`;
}

const PING_EVERY_MS = 15_000;

/**
 * Reports learning time to the API every 15 s and when the page is hidden or
 * left. `read()` returns the current position and seconds watched since the
 * last report. The server caps the credited time, so this is only a hint.
 */
export function useProgressReporter(
  lessonId: string,
  enabled: boolean,
  read: () => { positionSeconds: number; watchedDelta: number },
  slug: string,
) {
  const queryClient = useQueryClient();
  const readRef = useRef(read);
  readRef.current = read;
  const completedRef = useRef(false);

  const flush = useCallback(
    async (keepalive = false) => {
      if (!enabled) return;
      const { positionSeconds, watchedDelta } = readRef.current();
      if (watchedDelta <= 0 && positionSeconds <= 0) return;
      const body = {
        positionSeconds: Math.floor(positionSeconds),
        watchedDelta: Math.min(600, Math.round(watchedDelta)),
      };
      if (keepalive) {
        // Page is closing: fire and forget.
        void fetch(`/api/learn/lessons/${lessonId}/progress`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          keepalive: true,
          credentials: "same-origin",
        });
        return;
      }
      try {
        const progress = await api<LessonProgress | null>(`/learn/lessons/${lessonId}/progress`, {
          method: "POST",
          body,
        });
        if (progress?.completed && !completedRef.current) {
          completedRef.current = true;
          toast.success(t.learning.player.completed);
          void queryClient.invalidateQueries({ queryKey: learningKeys.outline(slug) });
          void queryClient.invalidateQueries({ queryKey: learningKeys.lesson(lessonId) });
        }
      } catch {
        // Progress is best effort; the next ping will catch up.
      }
    },
    [enabled, lessonId, queryClient, slug],
  );

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => void flush(), PING_EVERY_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush(true);
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", onHide);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", onHide);
      void flush(true);
    };
  }, [enabled, flush]);

  return { flush, markCompletedSeen: (v: boolean) => (completedRef.current = v) };
}
