"use client";

import { useActionState } from "react";
import Link from "next/link";
import { MEMORY_CATEGORIES, MEMORY_CATEGORY_LABELS } from "@/lib/learning-memories/constants";
import type { ActionState } from "@/lib/actions/learning-memories";

interface CourseOption {
  id: string;
  label: string;
}

interface MemoryFormDefaults {
  content?: string;
  category?: string;
  courseId?: string;
}

interface MemoryFormProps {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  courses: CourseOption[];
  submitLabel: string;
  defaultValues?: MemoryFormDefaults;
  cancelHref: string;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function MemoryForm({
  action,
  courses,
  submitLabel,
  defaultValues,
  cancelHref,
}: MemoryFormProps) {
  const [state, formAction, pending] = useActionState<ActionState, FormData>(action, undefined);

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label htmlFor="content" className="block text-sm font-medium text-slate-700">
          What&apos;s on your mind?
        </label>
        <textarea
          id="content"
          name="content"
          rows={4}
          required
          defaultValue={defaultValues?.content}
          placeholder="I finally understood recursion today."
          className={inputClassName}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="category" className="block text-sm font-medium text-slate-700">
            Category
          </label>
          <select
            id="category"
            name="category"
            defaultValue={defaultValues?.category ?? "general"}
            className={inputClassName}
          >
            {MEMORY_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {MEMORY_CATEGORY_LABELS[category]}
              </option>
            ))}
          </select>
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
