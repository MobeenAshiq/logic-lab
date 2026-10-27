"use client";

import { Pause, Play, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { t } from "@/lib/i18n";
import { applyEvents, isEdit } from "@/lib/integrity";
import { formatClock } from "@/lib/learning";
import { cn } from "@/lib/utils";
import type { TypingEvent } from "@/types/api";

const SPEEDS = [1, 4, 16];
/** Long pauses are shortened so a replay never stalls. */
const MAX_GAP_MS = 1500;
const BIG_INSERT = 200;

/**
 * Plays back how an answer was typed, edit by edit, with a scrubber. Large
 * inserts (possible pastes) are marked on the timeline.
 */
export function TypingReplay({ events, code = false }: { events: TypingEvent[]; code?: boolean }) {
  const ordered = useMemo(() => [...events].sort((a, b) => a.at - b.at), [events]);
  const [index, setIndex] = useState(ordered.length);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4);
  const timer = useRef<number | null>(null);
  const start = ordered[0]?.at ?? 0;

  const text = useMemo(() => applyEvents(ordered, index), [ordered, index]);
  const markers = useMemo(() => {
    const out: { i: number; kind: "burst" | "paste" }[] = [];
    ordered.forEach((e, i) => {
      if (!isEdit(e)) out.push({ i, kind: "paste" });
      else if (e.ins.length > BIG_INSERT) out.push({ i, kind: "burst" });
    });
    return out;
  }, [ordered]);

  useEffect(() => {
    if (!playing) return;
    if (index >= ordered.length) {
      setPlaying(false);
      return;
    }
    const gap = index === 0 ? 0 : Math.min(ordered[index].at - ordered[index - 1].at, MAX_GAP_MS);
    timer.current = window.setTimeout(() => setIndex((i) => i + 1), gap / speed);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [playing, index, ordered, speed]);

  if (ordered.length === 0) {
    return <p className="text-muted-foreground text-sm">{t.assessments.replay.empty}</p>;
  }

  const current = ordered[Math.max(0, index - 1)];
  return (
    <div className="space-y-3">
      <pre
        className={cn(
          "bg-muted/40 max-h-80 min-h-32 overflow-auto rounded-lg border p-3 text-sm whitespace-pre-wrap",
          code ? "font-mono text-[13px]" : "font-sans",
        )}
      >
        {text}
        {playing && (
          <span className="bg-primary ml-px inline-block h-4 w-0.5 animate-pulse align-middle" />
        )}
      </pre>

      <div className="relative">
        <input
          type="range"
          min={0}
          max={ordered.length}
          value={index}
          onChange={(e) => {
            setPlaying(false);
            setIndex(Number(e.target.value));
          }}
          className="accent-primary w-full"
          aria-label={t.assessments.replay.title}
        />
        <div className="pointer-events-none absolute inset-x-0 -bottom-1 h-2">
          {markers.map((m) => (
            <span
              key={m.i}
              title={
                m.kind === "burst" ? t.assessments.replay.burstMarker : t.assessments.flags.paste(1)
              }
              className={cn(
                "absolute h-2 w-1 rounded-full",
                m.kind === "burst" ? "bg-destructive" : "bg-warning",
              )}
              style={{ left: `${(m.i / ordered.length) * 100}%` }}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Button
          size="sm"
          onClick={() => {
            if (index >= ordered.length) setIndex(0);
            setPlaying((p) => !p);
          }}
        >
          {playing ? <Pause /> : <Play />}
          {playing ? t.assessments.replay.pause : t.assessments.replay.play}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setPlaying(false);
            setIndex(0);
          }}
        >
          <RotateCcw /> {t.assessments.replay.restart}
        </Button>
        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t.assessments.replay.speed}
        >
          {SPEEDS.map((s) => (
            <Button
              key={s}
              size="xs"
              variant={s === speed ? "secondary" : "ghost"}
              aria-pressed={s === speed}
              onClick={() => setSpeed(s)}
            >
              {s}×
            </Button>
          ))}
        </div>
        <span className="text-muted-foreground ml-auto text-xs">
          {t.assessments.replay.step(index, ordered.length)} ·{" "}
          {formatClock((current.at - start) / 1000)}
        </span>
      </div>
    </div>
  );
}
