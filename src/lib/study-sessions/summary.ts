function toDayKey(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

export interface SessionLike {
  date: Date;
  durationMinutes: number;
}

export function totalMinutes(sessions: SessionLike[]): number {
  return sessions.reduce((sum, session) => sum + session.durationMinutes, 0);
}

/** Sum of session minutes whose calendar day falls within [from, to], inclusive. */
export function minutesBetween(sessions: SessionLike[], from: Date, to: Date): number {
  const fromKey = toDayKey(from);
  const toKey = toDayKey(to);
  return totalMinutes(
    sessions.filter((session) => {
      const key = toDayKey(session.date);
      return key >= fromKey && key <= toKey;
    }),
  );
}

export function minutesOnDay(sessions: SessionLike[], day: Date): number {
  return minutesBetween(sessions, day, day);
}

/** Formats minutes as "1h 30m", "45m", or "2h" — never "1h 0m". */
export function formatDuration(minutes: number): string {
  if (minutes <= 0) return "0m";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}
