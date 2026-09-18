import Link from "next/link";
import { getTaskUrgency, type TaskUrgency } from "@/lib/tasks/overdue";
import type { TaskStatus } from "@/lib/tasks/constants";
import { StatusToggle } from "./tasks/status-toggle";

export interface UpcomingTaskData {
  id: string;
  title: string;
  dueDate: Date | null;
  status: TaskStatus;
  courseCode: string | null;
}

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
  });
}

function dueDateLabel(dueDate: Date | null, urgency: TaskUrgency): string {
  if (!dueDate) return "No due date";
  if (urgency === "overdue") return `Overdue · ${formatDueDate(dueDate)}`;
  if (urgency === "due-today") return "Due today";
  return `Due ${formatDueDate(dueDate)}`;
}

export function UpcomingTasksWidget({
  tasks,
  now = new Date(),
}: {
  tasks: UpcomingTaskData[];
  now?: Date;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900">What&apos;s next</h2>
        <Link
          href="/dashboard/tasks"
          className="text-sm font-medium text-indigo-600 hover:underline"
        >
          View all tasks
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-slate-500">
          Nothing on your list.{" "}
          <Link href="/dashboard/tasks/new" className="font-medium text-indigo-600 hover:underline">
            Add a task
          </Link>
          .
        </p>
      ) : (
        <div>
          {tasks.map((task) => {
            const urgency = getTaskUrgency(task.status, task.dueDate, now);
            return (
              <div
                key={task.id}
                className="flex items-center gap-3 border-b border-slate-100 py-2 last:border-0"
              >
                <StatusToggle taskId={task.id} completed={task.status === "completed"} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/tasks/${task.id}/edit`}
                    className="block truncate text-sm font-medium text-slate-900 hover:text-indigo-600"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    {task.courseCode && <span className="text-slate-500">{task.courseCode}</span>}
                    <span className={URGENCY_STYLES[urgency]}>
                      {dueDateLabel(task.dueDate, urgency)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
