import { describe, expect, it } from "vitest";
import { getTaskUrgency, isOverdue } from "./overdue";

const NOW = new Date("2026-06-15T18:00:00Z"); // late in the day, UTC

describe("isOverdue", () => {
  it("is false when there is no due date", () => {
    expect(isOverdue("todo", null, NOW)).toBe(false);
  });

  it("is false for a completed task even if the due date has passed", () => {
    expect(isOverdue("completed", new Date("2026-06-01T00:00:00Z"), NOW)).toBe(false);
  });

  it("is true when the due date's calendar day is before today", () => {
    expect(isOverdue("todo", new Date("2026-06-14T23:59:00Z"), NOW)).toBe(true);
  });

  it("is false when the due date is today, regardless of time of day", () => {
    // Due date parsed from a plain <input type="date"> is UTC midnight;
    // "now" being later in the same UTC day must not count as overdue.
    expect(isOverdue("todo", new Date("2026-06-15T00:00:00Z"), NOW)).toBe(false);
  });

  it("is false when the due date is in the future", () => {
    expect(isOverdue("in_progress", new Date("2026-06-16T00:00:00Z"), NOW)).toBe(false);
  });
});

describe("getTaskUrgency", () => {
  it("returns completed for a completed task regardless of due date", () => {
    expect(getTaskUrgency("completed", new Date("2020-01-01"), NOW)).toBe("completed");
    expect(getTaskUrgency("completed", null, NOW)).toBe("completed");
  });

  it("returns no-due-date when there is no due date and it's not completed", () => {
    expect(getTaskUrgency("todo", null, NOW)).toBe("no-due-date");
  });

  it("returns overdue for a past due date", () => {
    expect(getTaskUrgency("todo", new Date("2026-06-10"), NOW)).toBe("overdue");
  });

  it("returns due-today for today's calendar date", () => {
    expect(getTaskUrgency("in_progress", new Date("2026-06-15T00:00:00Z"), NOW)).toBe("due-today");
  });

  it("returns upcoming for a future due date", () => {
    expect(getTaskUrgency("todo", new Date("2026-06-20"), NOW)).toBe("upcoming");
  });
});
