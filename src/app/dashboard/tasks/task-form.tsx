"use client";

import { useActionState } from "react";
import Link from "next/link";
import {
  TASK_TYPES,
  TASK_TYPE_LABELS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
} from "@/lib/tasks/constants";
import type { ActionState } from "@/lib/actions/tasks";

interface CourseOption {
  id: string;
  label: string;
}

interface TaskFormDefaults {
  title?: string;
  description?: string;
  type?: string;
  priority?: string;
  status?: string;
  dueDate?: string;
  courseId?: string;
}

interface TaskFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  courses: CourseOption[];
  submitLabel: string;
  defaultValues?: TaskFormDefaults;
  showStatus?: boolean;
  cancelHref: string;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function TaskForm({
  action,
  courses,
  submitLabel,
  defaultValues,
  showStatus,
  cancelHref,
}: TaskFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          required
          defaultValue={defaultValues?.title}
          placeholder="Submit problem set 3"
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="description" className="block text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={defaultValues?.description}
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className="block text-sm font-medium text-slate-700">
            Type
          </label>
          <select
            id="type"
            name="type"
            defaultValue={defaultValues?.type ?? "assignment"}
            className={inputClassName}
          >
            {TASK_TYPES.map((type) => (
              <option key={type} value={type}>
                {TASK_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="priority" className="block text-sm font-medium text-slate-700">
            Priority
          </label>
          <select
            id="priority"
            name="priority"
            defaultValue={defaultValues?.priority ?? "medium"}
            className={inputClassName}
          >
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="dueDate" className="block text-sm font-medium text-slate-700">
            Due date <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="dueDate"
            name="dueDate"
            type="date"
            defaultValue={defaultValues?.dueDate}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="courseId" className="block text-sm font-medium text-slate-700">
            Course <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <select
            id="courseId"
            name="courseId"
            defaultValue={defaultValues?.courseId ?? ""}
            className={inputClassName}
          >
            <option value="">No course</option>
            {courses.map((course) => (
              <option key={course.id} value={course.id}>
                {course.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {showStatus && (
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-slate-700">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={defaultValues?.status ?? "todo"}
            className={inputClassName}
          >
            {TASK_STATUSES.map((status) => (
              <option key={status} value={status}>
                {TASK_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </div>
      )}

      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Saving..." : submitLabel}
        </button>
        <Link href={cancelHref} className="text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </Link>
      </div>
    </form>
  );
}
