import Link from "next/link";
import type { Types, QueryFilter } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Task, type ITask } from "@/models/Task";
import { Course } from "@/models/Course";
import { getTaskUrgency, type TaskUrgency } from "@/lib/tasks/overdue";
import { compareTasks, TASK_SORTS } from "@/lib/tasks/sort";
import { TaskFilterBar } from "../filter-bar";
import { TaskRow, type TaskRowData } from "../task-row";

interface TaskLean {
  _id: Types.ObjectId;
  title: string;
  type: ITask["type"];
  priority: ITask["priority"];
  status: ITask["status"];
  dueDate: Date | null;
  courseId: { _id: Types.ObjectId; code: string; title: string } | null;
}

const STATUS_FILTERS = ["active", "todo", "in_progress", "completed", "all"] as const;

const BUCKET_ORDER: TaskUrgency[] = ["overdue", "due-today", "upcoming", "no-due-date", "completed"];
const BUCKET_LABELS: Record<TaskUrgency, string> = {
  overdue: "Overdue",
  "due-today": "Due today",
  upcoming: "Upcoming",
  "no-due-date": "No due date",
  completed: "Completed",
};

export default async function TasksPage({
  searchParams,
}: PageProps<"/dashboard/tasks">) {
  const userId = await requireUserId();
  const params = await searchParams;

  const statusFilter = pickOne(params.status, STATUS_FILTERS, "active");
  const sort = pickOne(params.sort, TASK_SORTS, "dueDate");
  const courseFilter = typeof params.course === "string" ? params.course : "";

  await connectToDatabase();

  const query: QueryFilter<ITask> = { userId };
  if (statusFilter === "active") {
    query.status = { $in: ["todo", "in_progress"] };
  } else if (statusFilter !== "all") {
    query.status = statusFilter;
  }
  if (courseFilter) {
    query.courseId = courseFilter;
  }

  const [tasks, courses, totalTaskCount] = await Promise.all([
    Task.find(query).populate("courseId", "code title").lean<TaskLean[]>(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
    Task.countDocuments({ userId }),
  ]);

  const now = new Date();

  const sorted = [...tasks].sort((a, b) =>
    compareTasks(sort)(
      { dueDate: a.dueDate, priority: a.priority, courseTitle: a.courseId?.title ?? null },
      { dueDate: b.dueDate, priority: b.priority, courseTitle: b.courseId?.title ?? null },
    ),
  );

  const buckets = new Map<TaskUrgency, TaskRowData[]>(BUCKET_ORDER.map((bucket) => [bucket, []]));
  for (const task of sorted) {
    const bucket = getTaskUrgency(task.status, task.dueDate, now);
    buckets.get(bucket)?.push({
      id: task._id.toString(),
      title: task.title,
      type: task.type,
      priority: task.priority,
      status: task.status,
      dueDate: task.dueDate,
      course: task.courseId ? { code: task.courseId.code, title: task.courseId.title } : null,
    });
  }

  const courseOptions = courses.map((course) => ({
    id: course._id.toString(),
    label: `${course.code} · ${course.title}`,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <Link
          href="/dashboard/tasks/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          New task
        </Link>
      </div>

      {totalTaskCount === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No tasks yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Add your first assignment, exam, or to-do to start tracking what&apos;s due.
          </p>
          <Link
            href="/dashboard/tasks/new"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Add a task
          </Link>
        </div>
      ) : (
        <>
          <TaskFilterBar courses={courseOptions} />

          {sorted.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
              No tasks match these filters.
            </p>
          ) : (
            <div className="space-y-6">
              {BUCKET_ORDER.filter((bucket) => (buckets.get(bucket)?.length ?? 0) > 0).map(
                (bucket) => (
                  <section key={bucket} className="rounded-2xl border border-slate-200 bg-white p-6">
                    <h2 className="mb-1 text-sm font-semibold text-slate-900">
                      {BUCKET_LABELS[bucket]}{" "}
                      <span className="font-normal text-slate-400">
                        ({buckets.get(bucket)?.length})
                      </span>
                    </h2>
                    <div>
                      {buckets.get(bucket)?.map((task) => (
                        <TaskRow key={task.id} task={task} now={now} />
                      ))}
                    </div>
                  </section>
                ),
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function pickOne<T extends string>(
  value: string | string[] | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const candidate = Array.isArray(value) ? value[0] : value;
  return (allowed as readonly string[]).includes(candidate ?? "") ? (candidate as T) : fallback;
}
