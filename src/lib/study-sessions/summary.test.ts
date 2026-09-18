import { describe, expect, it } from "vitest";
import { formatDuration, minutesBetween, minutesOnDay, totalMinutes } from "./summary";

const day = (offset: number) => new Date(Date.UTC(2026, 5, 15 + offset));

describe("totalMinutes", () => {
  it("sums durations across sessions", () => {
    const sessions = [
      { date: day(0), durationMinutes: 30 },
      { date: day(-1), durationMinutes: 45 },
    ];
    expect(totalMinutes(sessions)).toBe(75);
  });

  it("is zero for an empty list", () => {
    expect(totalMinutes([])).toBe(0);
  });
});

describe("minutesBetween", () => {
  const sessions = [
    { date: day(-10), durationMinutes: 60 },
    { date: day(-2), durationMinutes: 30 },
    { date: day(-1), durationMinutes: 20 },
    { date: day(0), durationMinutes: 15 },
  ];

  it("includes only sessions within the inclusive range", () => {
    expect(minutesBetween(sessions, day(-2), day(0))).toBe(65);
  });

  it("excludes sessions outside the range", () => {
    expect(minutesBetween(sessions, day(-1), day(0))).toBe(35);
  });

  it("returns zero when nothing falls in range", () => {
    expect(minutesBetween(sessions, day(5), day(10))).toBe(0);
  });
});

describe("minutesOnDay", () => {
  it("sums only sessions on that exact calendar day", () => {
    const sessions = [
      { date: day(0), durationMinutes: 20 },
      { date: day(0), durationMinutes: 10 },
      { date: day(-1), durationMinutes: 100 },
    ];
    expect(minutesOnDay(sessions, day(0))).toBe(30);
  });
});

describe("formatDuration", () => {
  it("formats minutes under an hour", () => {
    expect(formatDuration(45)).toBe("45m");
  });

  it("formats whole hours without a minutes suffix", () => {
    expect(formatDuration(120)).toBe("2h");
  });

  it("formats hours with remaining minutes", () => {
    expect(formatDuration(90)).toBe("1h 30m");
  });

  it("formats zero and negative durations as 0m", () => {
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(-5)).toBe("0m");
  });
});
