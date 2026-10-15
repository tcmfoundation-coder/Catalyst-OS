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
  overdue: "text-danger",
  "due-today": "text-caution",
  upcoming: "text-muted",
  "no-due-date": "text-muted",
  completed: "text-muted",
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
    <section className="hud-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Mission queue</h2>
        <Link
          href="/dashboard/tasks"
          className="text-xs font-medium text-accent hover:underline"
        >
          View all tasks
        </Link>
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted">
          Nothing on your list.{" "}
          <Link href="/dashboard/tasks/new" className="font-medium text-accent hover:underline">
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
                className="flex items-center gap-3 border-b border-line/70 py-3 last:border-0"
              >
                <StatusToggle taskId={task.id} completed={task.status === "completed"} />
                <div className="min-w-0 flex-1">
                  <Link
                    href={`/dashboard/tasks/${task.id}/edit`}
                    className="block truncate text-sm font-medium text-foreground hover:text-accent"
                  >
                    {task.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs">
                    {task.courseCode && <span className="font-mono text-[10px] tracking-wider text-accent">{task.courseCode}</span>}
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
