"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TASK_STATUS_LABELS } from "@/lib/tasks/constants";

interface CourseOption {
  id: string;
  label: string;
}

const STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "todo", label: TASK_STATUS_LABELS.todo },
  { value: "in_progress", label: TASK_STATUS_LABELS.in_progress },
  { value: "completed", label: TASK_STATUS_LABELS.completed },
  { value: "all", label: "All" },
];

const SORT_OPTIONS = [
  { value: "dueDate", label: "Due date" },
  { value: "priority", label: "Priority" },
  { value: "course", label: "Course" },
];

const selectClassName =
  "rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function TaskFilterBar({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <select
        aria-label="Filter by status"
        value={searchParams.get("status") ?? "active"}
        onChange={(event) => updateParam("status", event.target.value)}
        className={selectClassName}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <select
        aria-label="Sort by"
        value={searchParams.get("sort") ?? "dueDate"}
        onChange={(event) => updateParam("sort", event.target.value)}
        className={selectClassName}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            Sort: {option.label}
          </option>
        ))}
      </select>

      {courses.length > 0 && (
        <select
          aria-label="Filter by course"
          value={searchParams.get("course") ?? ""}
          onChange={(event) => updateParam("course", event.target.value)}
          className={selectClassName}
        >
          <option value="">All courses</option>
          {courses.map((course) => (
            <option key={course.id} value={course.id}>
              {course.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
