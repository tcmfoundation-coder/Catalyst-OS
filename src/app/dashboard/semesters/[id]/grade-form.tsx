"use client";

import { useActionState } from "react";
import { updateCourseGrade, type ActionState } from "@/lib/actions/courses";
import { DEFAULT_GRADING_SCALE } from "@/lib/academic/grading-scale";

export function GradeForm({
  courseId,
  currentGrade,
}: {
  courseId: string;
  currentGrade: string | null;
}) {
  const boundAction = updateCourseGrade.bind(null, courseId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex items-center gap-2">
      <select
        key={currentGrade ?? ""}
        name="grade"
        defaultValue={currentGrade ?? ""}
        className="rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
      >
        <option value="">Not graded</option>
        {Object.keys(DEFAULT_GRADING_SCALE).map((letter) => (
          <option key={letter} value={letter}>
            {letter}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
      >
        Save
      </button>
      {state?.error && <span className="text-xs text-red-600">{state.error}</span>}
    </form>
  );
}
