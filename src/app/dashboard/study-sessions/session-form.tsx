"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { ActionState } from "@/lib/actions/study-sessions";

interface CourseOption {
  id: string;
  label: string;
}

interface SessionFormDefaults {
  date?: string;
  durationMinutes?: string;
  courseId?: string;
  notes?: string;
}

interface SessionFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  courses: CourseOption[];
  submitLabel: string;
  defaultValues?: SessionFormDefaults;
  cancelHref: string;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

export function SessionForm({
  action,
  courses,
  submitLabel,
  defaultValues,
  cancelHref,
}: SessionFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="date" className="block text-sm font-medium text-slate-700">
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            required
            max={todayInputValue()}
            defaultValue={defaultValues?.date ?? todayInputValue()}
            className={inputClassName}
          />
        </div>
        <div>
          <label htmlFor="durationMinutes" className="block text-sm font-medium text-slate-700">
            Duration (minutes)
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min={1}
            max={1440}
            required
            defaultValue={defaultValues?.durationMinutes ?? 30}
            className={inputClassName}
          />
        </div>
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

      <div>
        <label htmlFor="notes" className="block text-sm font-medium text-slate-700">
          Notes <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={defaultValues?.notes}
          placeholder="What did you work on?"
          className={inputClassName}
        />
      </div>

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
