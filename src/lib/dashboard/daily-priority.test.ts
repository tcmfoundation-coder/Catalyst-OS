import { describe, expect, it } from "vitest";
import { isPriorityCandidateAllowed, type DailyPriority } from "./daily-priority";

const recommendation: DailyPriority = {
  title: "Submit the calculus assignment",
  reason: "It is due first and marked high priority.",
  nextStep: "Review the problem set and solve question one.",
  taskId: "task-123",
};

describe("isPriorityCandidateAllowed", () => {
  it("accepts only the exact task and title from the allowed candidates", () => {
    expect(isPriorityCandidateAllowed(recommendation, [
      { id: "task-123", title: "Submit the calculus assignment" },
      { id: "task-456", title: "Read chapter four" },
    ])).toBe(true);
    expect(isPriorityCandidateAllowed({ ...recommendation, taskId: "task-foreign" }, [
      { id: "task-123", title: "Submit the calculus assignment" },
    ])).toBe(false);
    expect(isPriorityCandidateAllowed({ ...recommendation, title: "An invented assignment" }, [
      { id: "task-123", title: "Submit the calculus assignment" },
    ])).toBe(false);
  });

  it("allows a task-free recommendation only when it has no task ID", () => {
    expect(isPriorityCandidateAllowed({ ...recommendation, title: "Review a recent lecture", taskId: null }, [])).toBe(true);
  });
});
