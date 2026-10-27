const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

export interface Slot {
  weekday: number;
  startMinute: number;
  endMinute: number;
}

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const toHHMM = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** Weekday and minute-of-day in Pakistan time. */
export function pktClock(now = new Date()) {
  const local = new Date(now.getTime() + PKT_OFFSET_MS);
  return {
    weekday: local.getUTCDay(),
    minute: local.getUTCHours() * 60 + local.getUTCMinutes(),
  };
}

export function isWithin(slots: Slot[], now = new Date()) {
  const { weekday, minute } = pktClock(now);
  return slots.some(
    (s) =>
      s.weekday === weekday && s.startMinute <= minute && minute < s.endMinute,
  );
}
