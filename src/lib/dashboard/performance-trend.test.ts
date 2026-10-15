import { describe, expect, it } from "vitest";
import { buildPerformanceTrend, getPerformanceTrendRange } from "./performance-trend";

const now = new Date("2026-10-15T18:05:00.000Z");

describe("buildPerformanceTrend", () => {
  it("returns seven UTC days with per-day study and completion totals", () => {
    const trend = buildPerformanceTrend(
      [
        { date: new Date("2026-10-09T09:00:00.000Z"), durationMinutes: 25 },
        { date: new Date("2026-10-09T17:00:00.000Z"), durationMinutes: 35 },
        { date: new Date("2026-10-15T10:00:00.000Z"), durationMinutes: 40 },
      ],
      [
        { completedAt: new Date("2026-10-09T12:00:00.000Z") },
        { completedAt: new Date("2026-10-15T11:00:00.000Z") },
      ],
      now,
    );

    expect(trend.days).toHaveLength(7);
    expect(trend.days[0]).toEqual({ date: "2026-10-09", studyMinutes: 60, completedTasks: 1 });
    expect(trend.days[6]).toEqual({ date: "2026-10-15", studyMinutes: 40, completedTasks: 1 });
    expect(trend.current).toEqual({ studyMinutes: 100, completedTasks: 2 });
  });

  it("compares the current week with the preceding seven days and ignores out-of-range records", () => {
    const trend = buildPerformanceTrend(
      [
        { date: new Date("2026-10-08T10:00:00.000Z"), durationMinutes: 90 },
        { date: new Date("2026-10-01T10:00:00.000Z"), durationMinutes: 300 },
        { date: new Date("2026-10-16T10:00:00.000Z"), durationMinutes: 500 },
      ],
      [
        { completedAt: new Date("2026-10-08T10:00:00.000Z") },
        { completedAt: new Date("2026-10-01T10:00:00.000Z") },
        { completedAt: null },
      ],
      now,
    );

    expect(trend.previous).toEqual({ studyMinutes: 90, completedTasks: 1 });
    expect(trend.current).toEqual({ studyMinutes: 0, completedTasks: 0 });
  });
});

describe("getPerformanceTrendRange", () => {
  it("covers the previous and current seven UTC calendar days", () => {
    expect(getPerformanceTrendRange(now)).toEqual({
      from: new Date("2026-10-02T00:00:00.000Z"),
      to: new Date("2026-10-16T00:00:00.000Z"),
    });
  });
});
