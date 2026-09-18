import { describe, expect, it } from "vitest";
import { calculateStreaks, lastNDays, toDayKey } from "./streak";

const TODAY = new Date("2026-06-15T12:00:00Z");
const day = (offset: number) => new Date(Date.UTC(2026, 5, 15 + offset));

describe("calculateStreaks", () => {
  it("returns zeros when there are no logs", () => {
    expect(calculateStreaks([], TODAY)).toEqual({ currentStreak: 0, longestStreak: 0 });
  });

  it("counts a streak that includes today", () => {
    const logs = [day(0), day(-1), day(-2)];
    expect(calculateStreaks(logs, TODAY)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it("still counts an open streak when today hasn't been logged yet", () => {
    const logs = [day(-1), day(-2), day(-3)];
    expect(calculateStreaks(logs, TODAY)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });

  it("resets current streak to zero once a day is missed", () => {
    // Missed yesterday: neither today nor yesterday logged.
    const logs = [day(-2), day(-3)];
    expect(calculateStreaks(logs, TODAY).currentStreak).toBe(0);
  });

  it("finds the longest streak even if it's not the current one", () => {
    // A 4-day streak two weeks ago, then a gap, then a 1-day streak today.
    const logs = [day(-20), day(-19), day(-18), day(-17), day(0)];
    expect(calculateStreaks(logs, TODAY)).toEqual({ currentStreak: 1, longestStreak: 4 });
  });

  it("is unaffected by duplicate or out-of-order log entries", () => {
    const logs = [day(0), day(0), day(-1), day(-2)];
    expect(calculateStreaks(logs, TODAY)).toEqual({ currentStreak: 3, longestStreak: 3 });
  });
});

describe("lastNDays", () => {
  it("returns n days ending with today, oldest first", () => {
    const days = lastNDays(3, TODAY);
    expect(days.map(toDayKey)).toEqual([toDayKey(day(-2)), toDayKey(day(-1)), toDayKey(day(0))]);
  });
});
