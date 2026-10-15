import { lastNDays } from "@/lib/habits/streak";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface PerformanceSession {
  date: Date;
  durationMinutes: number;
}

export interface CompletedTask {
  completedAt: Date | null;
}

export interface PerformanceTrend {
  days: {
    date: string;
    studyMinutes: number;
    completedTasks: number;
  }[];
  current: {
    studyMinutes: number;
    completedTasks: number;
  };
  previous: {
    studyMinutes: number;
    completedTasks: number;
  };
}

export function getPerformanceTrendRange(now: Date = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return {
    from: new Date(today.getTime() - 13 * DAY_MS),
    to: new Date(today.getTime() + DAY_MS),
  };
}

export function buildPerformanceTrend(
  sessions: PerformanceSession[],
  tasks: CompletedTask[],
  now: Date = new Date(),
): PerformanceTrend {
  const days = lastNDays(7, now).map((day) => ({
    date: day.toISOString().slice(0, 10),
    studyMinutes: 0,
    completedTasks: 0,
  }));
  const currentStart = Date.parse(days[0].date);
  const previousStart = currentStart - 7 * DAY_MS;
  const today = Date.parse(days[days.length - 1].date);
  const pointsByDay = new Map(days.map((point) => [point.date, point]));
  const current = { studyMinutes: 0, completedTasks: 0 };
  const previous = { studyMinutes: 0, completedTasks: 0 };

  for (const session of sessions) {
    const dayKey = Date.UTC(
      session.date.getUTCFullYear(),
      session.date.getUTCMonth(),
      session.date.getUTCDate(),
    );
    if (dayKey >= currentStart && dayKey <= today) {
      const point = pointsByDay.get(new Date(dayKey).toISOString().slice(0, 10));
      if (point) point.studyMinutes += session.durationMinutes;
      current.studyMinutes += session.durationMinutes;
    } else if (dayKey >= previousStart && dayKey < currentStart) {
      previous.studyMinutes += session.durationMinutes;
    }
  }

  for (const task of tasks) {
    if (!task.completedAt) continue;
    const dayKey = Date.UTC(
      task.completedAt.getUTCFullYear(),
      task.completedAt.getUTCMonth(),
      task.completedAt.getUTCDate(),
    );
    if (dayKey >= currentStart && dayKey <= today) {
      const point = pointsByDay.get(new Date(dayKey).toISOString().slice(0, 10));
      if (point) point.completedTasks += 1;
      current.completedTasks += 1;
    } else if (dayKey >= previousStart && dayKey < currentStart) {
      previous.completedTasks += 1;
    }
  }

  return { days, current, previous };
}
