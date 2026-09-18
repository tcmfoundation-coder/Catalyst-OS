const DAY_MS = 24 * 60 * 60 * 1000;

/** Calendar day as a UTC-midnight timestamp, matching how dueDate/date fields are stored. */
export function toDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/** The last n calendar days (UTC), oldest first, ending with today. */
export function lastNDays(n: number, now: Date = new Date()): Date[] {
  const todayKey = toDayKey(now);
  const days: Date[] = [];
  for (let i = n - 1; i >= 0; i--) {
    days.push(new Date(todayKey - i * DAY_MS));
  }
  return days;
}

export interface StreakResult {
  currentStreak: number;
  longestStreak: number;
}

/**
 * currentStreak counts consecutive completed days ending today. If today
 * isn't logged yet, it counts back from yesterday instead, so a streak that
 * is still "open" (the day isn't over) doesn't read as already broken.
 * longestStreak scans every logged day for the longest consecutive run,
 * regardless of whether it's still active.
 */
export function calculateStreaks(logDates: Date[], now: Date = new Date()): StreakResult {
  const days = new Set(logDates.map(toDayKey));
  const todayKey = toDayKey(now);

  let currentStreak = 0;
  let cursor = days.has(todayKey) ? todayKey : todayKey - DAY_MS;
  while (days.has(cursor)) {
    currentStreak += 1;
    cursor -= DAY_MS;
  }

  let longestStreak = 0;
  for (const day of days) {
    if (days.has(day - DAY_MS)) continue; // not the start of a run
    let length = 0;
    let scan = day;
    while (days.has(scan)) {
      length += 1;
      scan += DAY_MS;
    }
    longestStreak = Math.max(longestStreak, length);
  }

  return { currentStreak, longestStreak };
}
