"use client";

import { useActionState } from "react";
import { createSemester, type ActionState } from "@/lib/actions/semesters";

export function CreateSemesterForm({ academicYearId }: { academicYearId: string }) {
  const boundAction = createSemester.bind(null, academicYearId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-3">
      <div className="min-w-[200px] flex-1">
        <label htmlFor="name" className="block text-sm font-medium text-slate-700">
          Semester name
        </label>
        <input
          id="name"
          name="name"
          placeholder="e.g. First Semester"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
      >
        {pending ? "Adding..." : "Add semester"}
      </button>
      {state?.error && (
        <p role="alert" className="w-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
