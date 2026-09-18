import { describe, expect, it } from "vitest";
import { compareTasks, type SortableTask } from "./sort";

function task(overrides: Partial<SortableTask>): SortableTask {
  return { dueDate: null, priority: "medium", courseTitle: null, ...overrides };
}

describe("compareTasks", () => {
  it("sorts by due date ascending, with no-due-date tasks last", () => {
    const soon = task({ dueDate: new Date("2026-01-05") });
    const later = task({ dueDate: new Date("2026-01-20") });
    const none = task({ dueDate: null });

    const sorted = [later, none, soon].sort(compareTasks("dueDate"));
    expect(sorted).toEqual([soon, later, none]);
  });

  it("sorts by priority (high first), using due date as a tiebreaker", () => {
    const highSoon = task({ priority: "high", dueDate: new Date("2026-01-10") });
    const highLater = task({ priority: "high", dueDate: new Date("2026-01-20") });
    const low = task({ priority: "low", dueDate: new Date("2026-01-01") });
    const medium = task({ priority: "medium", dueDate: new Date("2026-01-01") });

    const sorted = [low, highLater, medium, highSoon].sort(compareTasks("priority"));
    expect(sorted).toEqual([highSoon, highLater, medium, low]);
  });

  it("sorts by course title alphabetically, with no-course tasks last", () => {
    const zoology = task({ courseTitle: "Zoology" });
    const algebra = task({ courseTitle: "Algebra" });
    const none = task({ courseTitle: null });

    const sorted = [zoology, none, algebra].sort(compareTasks("course"));
    expect(sorted).toEqual([algebra, zoology, none]);
  });
});
