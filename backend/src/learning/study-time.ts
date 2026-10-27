// Learning days follow Pakistan time (UTC+5, no daylight saving).
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The Pakistan calendar day of `date`, as a UTC-midnight Date (for @db.Date columns). */
export function pktDay(date = new Date()): Date {
  const local = new Date(date.getTime() + PKT_OFFSET_MS);
  return new Date(
    Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()),
  );
}

/** Monday of the current Pakistan week. */
export function pktWeekStart(date = new Date()): Date {
  const day = pktDay(date);
  const weekday = (day.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(day.getTime() - weekday * DAY_MS);
}

/** A day counts towards the streak after this much learning. */
export const STREAK_MIN_SECONDS = 60;

/**
 * Consecutive learning days ending today, or yesterday if the student has not
 * studied yet today (the streak is not broken until the day is over).
 */
export function streakFrom(
  days: { day: Date; seconds: number }[],
  now = new Date(),
) {
  const active = new Set(
    days
      .filter((d) => d.seconds >= STREAK_MIN_SECONDS)
      .map((d) => d.day.getTime()),
  );
  let cursor = pktDay(now).getTime();
  if (!active.has(cursor)) cursor -= DAY_MS;
  let streak = 0;
  while (active.has(cursor)) {
    streak++;
    cursor -= DAY_MS;
  }
  return streak;
}
