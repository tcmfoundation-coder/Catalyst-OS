import type { TaskStatus } from "./constants";

export type TaskUrgency = "overdue" | "due-today" | "upcoming" | "no-due-date" | "completed";

function startOfUtcDay(date: Date): number {
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

/**
 * True when a task is past its due date and not yet completed. Due dates
 * are compared as UTC calendar days (matching how a plain
 * <input type="date"> value is parsed as UTC midnight), not exact
 * timestamps, so "today" doesn't shift depending on what time it is.
 */
export function isOverdue(status: TaskStatus, dueDate: Date | null, now: Date = new Date()): boolean {
  if (status === "completed" || !dueDate) {
    return false;
  }
  return startOfUtcDay(dueDate) < startOfUtcDay(now);
}

/** Buckets a task for grouping/display purposes. See isOverdue for the date comparison rules. */
export function getTaskUrgency(
  status: TaskStatus,
  dueDate: Date | null,
  now: Date = new Date(),
): TaskUrgency {
  if (status === "completed") {
    return "completed";
  }
  if (!dueDate) {
    return "no-due-date";
  }
  const due = startOfUtcDay(dueDate);
  const today = startOfUtcDay(now);
  if (due < today) return "overdue";
  if (due === today) return "due-today";
  return "upcoming";
}
