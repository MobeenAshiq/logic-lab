import { z } from 'zod';

/**
 * What the write-only editor records for every change: at `pos`, `del`
 * characters were removed and `ins` was inserted. A `paste` event marks a
 * blocked paste attempt. Replaying the events in order rebuilds the answer.
 */
export const typingEventSchema = z.union([
  z.strictObject({
    at: z.number().int().nonnegative(),
    pos: z.number().int().min(0).max(100_000),
    del: z.number().int().min(0).max(100_000),
    ins: z.string().max(5_000),
  }),
  z.strictObject({
    at: z.number().int().nonnegative(),
    kind: z.literal('paste_blocked'),
  }),
]);

export const typingBatchSchema = z.array(typingEventSchema).max(1_000);

export type TypingEvent = z.infer<typeof typingEventSchema>;
type EditEvent = Extract<TypingEvent, { ins: string }>;

/** Max events kept per answer (a long essay is ~10-20k). */
export const MAX_EVENTS = 50_000;

export const BURST_CHARS = 200; // more than this in 1 second = flagged
export const BURST_WINDOW_MS = 1_000;
export const SPEED_CHARS = 150; // more than this in 10 seconds (15 chars/s) = flagged
export const SPEED_WINDOW_MS = 10_000;

export interface IntegrityFlags {
  /** Over 200 characters appeared within 1 second. */
  burst: boolean;
  burstMaxChars: number;
  /** Sustained typing faster than a human can type. */
  fastTyping: boolean;
  fastestCharsPer10s: number;
  pasteAttempts: number;
  /** The submitted text differs from what the recorded typing produces. */
  contentMismatch: boolean;
  typedChars: number;
  eventCount: number;
}

function isEdit(e: TypingEvent): e is EditEvent {
  return 'ins' in e;
}

/** Applies the events to an empty string. */
export function replay(events: TypingEvent[]): string {
  let text = '';
  for (const e of events) {
    if (!isEdit(e)) continue;
    const pos = Math.min(e.pos, text.length);
    text = text.slice(0, pos) + e.ins + text.slice(pos + e.del);
  }
  return text;
}

/** Largest number of inserted characters within any window of `windowMs`. */
function maxInWindow(edits: EditEvent[], windowMs: number) {
  let max = 0;
  let sum = 0;
  let start = 0;
  for (let end = 0; end < edits.length; end++) {
    sum += edits[end].ins.length;
    while (edits[end].at - edits[start].at >= windowMs) {
      sum -= edits[start].ins.length;
      start++;
    }
    max = Math.max(max, sum);
  }
  return max;
}

/** Heuristic integrity checks. Flags are shown to mentors; nothing is auto-penalized. */
export function computeFlags(
  events: TypingEvent[],
  finalText: string,
): IntegrityFlags {
  const edits = events.filter(isEdit).sort((a, b) => a.at - b.at);
  const burstMaxChars = maxInWindow(edits, BURST_WINDOW_MS);
  const fastest = maxInWindow(edits, SPEED_WINDOW_MS);
  const reconstructed = replay(events);
  return {
    burst: burstMaxChars > BURST_CHARS,
    burstMaxChars,
    fastTyping: fastest > SPEED_CHARS,
    fastestCharsPer10s: fastest,
    pasteAttempts: events.length - edits.length,
    contentMismatch: reconstructed.trim() !== finalText.trim(),
    typedChars: edits.reduce((n, e) => n + e.ins.length, 0),
    eventCount: events.length,
  };
}

export function hasFlags(f: Partial<IntegrityFlags> | undefined) {
  return Boolean(
    f &&
    (f.burst ||
      f.fastTyping ||
      f.contentMismatch ||
      (f.pasteAttempts ?? 0) > 0),
  );
}

/** Safely reads stored events (JSON column). */
export function asEvents(value: unknown): TypingEvent[] {
  const parsed = typingBatchSchema.max(MAX_EVENTS).safeParse(value);
  return parsed.success ? parsed.data : [];
}
