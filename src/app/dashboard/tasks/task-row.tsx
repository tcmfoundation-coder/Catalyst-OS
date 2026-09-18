import Link from "next/link";
import {
  TASK_TYPE_LABELS,
  TASK_PRIORITY_LABELS,
  type TaskType,
  type TaskPriority,
  type TaskStatus,
} from "@/lib/tasks/constants";
import { getTaskUrgency, type TaskUrgency } from "@/lib/tasks/overdue";
import { StatusToggle } from "./status-toggle";
import { DeleteTaskButton } from "./delete-task-button";

export interface TaskRowData {
  id: string;
  title: string;
  type: TaskType;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate: Date | null;
  course: { code: string; title: string } | null;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  high: "bg-red-50 text-red-700",
  medium: "bg-amber-50 text-amber-700",
  low: "bg-slate-100 text-slate-600",
};

const URGENCY_STYLES: Record<TaskUrgency, string> = {
  overdue: "text-red-600",
  "due-today": "text-amber-600",
  upcoming: "text-slate-500",
  "no-due-date": "text-slate-400",
  completed: "text-slate-400",
};

function formatDueDate(dueDate: Date): string {
  return new Date(dueDate).toLocaleDateString(undefined, {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function dueDateLabel(dueDate: Date, urgency: TaskUrgency): string {
  if (urgency === "overdue") return `Overdue · ${formatDueDate(dueDate)}`;
  if (urgency === "due-today") return "Due today";
  return `Due ${formatDueDate(dueDate)}`;
}

export function TaskRow({ task, now = new Date() }: { task: TaskRowData; now?: Date }) {
  const urgency = getTaskUrgency(task.status, task.dueDate, now);
  const completed = task.status === "completed";

  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <div className="pt-0.5">
        <StatusToggle taskId={task.id} completed={completed} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/dashboard/tasks/${task.id}/edit`}
            className={`font-medium hover:text-indigo-600 ${
              completed ? "text-slate-400 line-through" : "text-slate-900"
            }`}
          >
            {task.title}
          </Link>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${PRIORITY_STYLES[task.priority]}`}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </span>
          <span className="text-xs text-slate-400">{TASK_TYPE_LABELS[task.type]}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
          {task.course && <span className="text-slate-500">{task.course.code}</span>}
          {task.dueDate ? (
            <span className={URGENCY_STYLES[urgency]}>{dueDateLabel(task.dueDate, urgency)}</span>
          ) : (
            <span className="text-slate-400">No due date</span>
          )}
        </div>
      </div>
      <DeleteTaskButton taskId={task.id} />
    </div>
  );
}
