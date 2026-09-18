import { describe, expect, it } from "vitest";
import { TaskInputSchema, TaskStatusInputSchema } from "./validation";

function validInput(overrides: Partial<Record<string, string>> = {}) {
  return {
    title: "Finish problem set 3",
    description: "",
    type: "assignment",
    priority: "medium",
    dueDate: "",
    courseId: "",
    ...overrides,
  };
}

describe("TaskInputSchema", () => {
  it("accepts a minimal valid task", () => {
    const result = TaskInputSchema.safeParse(validInput());
    expect(result.success).toBe(true);
  });

  it("rejects a title that's too short", () => {
    const result = TaskInputSchema.safeParse(validInput({ title: "A" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized task type", () => {
    const result = TaskInputSchema.safeParse(validInput({ type: "homework" }));
    expect(result.success).toBe(false);
  });

  it("rejects an unrecognized priority", () => {
    const result = TaskInputSchema.safeParse(validInput({ priority: "urgent" }));
    expect(result.success).toBe(false);
  });

  it("accepts an empty due date (no due date set)", () => {
    const result = TaskInputSchema.safeParse(validInput({ dueDate: "" }));
    expect(result.success).toBe(true);
  });

  it("accepts a well-formed due date", () => {
    const result = TaskInputSchema.safeParse(validInput({ dueDate: "2026-09-25" }));
    expect(result.success).toBe(true);
  });

  it("rejects a malformed due date", () => {
    const result = TaskInputSchema.safeParse(validInput({ dueDate: "not-a-date" }));
    expect(result.success).toBe(false);
  });
});

describe("TaskStatusInputSchema", () => {
  it("accepts each valid status", () => {
    for (const status of ["todo", "in_progress", "completed"]) {
      expect(TaskStatusInputSchema.safeParse({ status }).success).toBe(true);
    }
  });

  it("rejects an invalid status", () => {
    expect(TaskStatusInputSchema.safeParse({ status: "done" }).success).toBe(false);
  });
});
