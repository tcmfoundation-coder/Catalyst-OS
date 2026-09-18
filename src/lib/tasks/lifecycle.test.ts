import { describe, expect, it } from "vitest";
import { nextCompletedAt } from "./lifecycle";

describe("nextCompletedAt", () => {
  it("stamps the current time when a task first becomes completed", () => {
    const now = new Date("2026-01-15T10:00:00Z");
    expect(nextCompletedAt("completed", "todo", null, now)).toEqual(now);
    expect(nextCompletedAt("completed", "in_progress", null, now)).toEqual(now);
  });

  it("clears completedAt when a task is reopened", () => {
    const previouslyCompletedAt = new Date("2026-01-10T09:00:00Z");
    expect(nextCompletedAt("todo", "completed", previouslyCompletedAt)).toBeNull();
    expect(nextCompletedAt("in_progress", "completed", previouslyCompletedAt)).toBeNull();
  });

  it("leaves completedAt untouched when a completed task stays completed", () => {
    const originalCompletedAt = new Date("2026-01-10T09:00:00Z");
    const now = new Date("2026-01-20T12:00:00Z");
    expect(nextCompletedAt("completed", "completed", originalCompletedAt, now)).toBe(
      originalCompletedAt,
    );
  });

  it("stays null for a task moving between non-completed statuses", () => {
    expect(nextCompletedAt("in_progress", "todo", null)).toBeNull();
    expect(nextCompletedAt("todo", "in_progress", null)).toBeNull();
  });
});
