import type { TypingEvent } from "@/types/api";

type EditEvent = Extract<TypingEvent, { ins: string }>;

export function isEdit(e: TypingEvent): e is EditEvent {
  return "ins" in e;
}

/** The single edit that turns `prev` into `next` (common prefix/suffix diff). */
export function diffEdit(prev: string, next: string, at = Date.now()): EditEvent | null {
  if (prev === next) return null;
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev[start] === next[start]) start++;
  let end = 0;
  while (end < max - start && prev[prev.length - 1 - end] === next[next.length - 1 - end]) {
    end++;
  }
  return {
    at,
    pos: start,
    del: prev.length - start - end,
    ins: next.slice(start, next.length - end),
  };
}

/** Applies events in order (same algorithm as the server). */
export function applyEvents(events: TypingEvent[], upTo = events.length, initial = "") {
  let text = initial;
  for (let i = 0; i < upTo; i++) {
    const e = events[i];
    if (!isEdit(e)) continue;
    const pos = Math.min(e.pos, text.length);
    text = text.slice(0, pos) + e.ins + text.slice(pos + e.del);
  }
  return text;
}
