import type { TaskStatus } from "./constants";

/**
 * Derives the next completedAt value for a status change. Stamps it the
 * moment a task first becomes completed, clears it the moment a task is no
 * longer completed (reopened), and leaves it untouched if the task was
 * already completed and stays completed (e.g. editing other fields) so
 * saving an edit doesn't silently bump the completion time.
 */
export function nextCompletedAt(
  nextStatus: TaskStatus,
  previousStatus: TaskStatus,
  previousCompletedAt: Date | null,
  now: Date = new Date(),
): Date | null {
  if (nextStatus !== "completed") {
    return null;
  }
  return previousStatus === "completed" ? previousCompletedAt : now;
}
