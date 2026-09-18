import type { TaskPriority } from "./constants";

export interface SortableTask {
  dueDate: Date | null;
  priority: TaskPriority;
  courseTitle: string | null;
}

export const TASK_SORTS = ["dueDate", "priority", "course"] as const;
export type TaskSort = (typeof TASK_SORTS)[number];

const PRIORITY_WEIGHT: Record<TaskPriority, number> = { high: 3, medium: 2, low: 1 };

function compareDueDate(a: SortableTask, b: SortableTask): number {
  if (a.dueDate === null && b.dueDate === null) return 0;
  if (a.dueDate === null) return 1;
  if (b.dueDate === null) return -1;
  return a.dueDate.getTime() - b.dueDate.getTime();
}

/**
 * Returns a comparator for sorting tasks by the given criterion, with due
 * date as the tiebreaker (and thus the sole ordering when sort is
 * "dueDate"). Tasks without a due date always sort last.
 */
export function compareTasks(sort: TaskSort): (a: SortableTask, b: SortableTask) => number {
  return (a, b) => {
    if (sort === "priority") {
      const diff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      return diff !== 0 ? diff : compareDueDate(a, b);
    }
    if (sort === "course") {
      const diff = (a.courseTitle ?? "￿").localeCompare(b.courseTitle ?? "￿");
      return diff !== 0 ? diff : compareDueDate(a, b);
    }
    return compareDueDate(a, b);
  };
}
