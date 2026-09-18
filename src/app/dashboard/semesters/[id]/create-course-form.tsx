"use client";

import { useActionState } from "react";
import { createCourse, type ActionState } from "@/lib/actions/courses";

export function CreateCourseForm({ semesterId }: { semesterId: string }) {
  const boundAction = createCourse.bind(null, semesterId);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(
    boundAction,
    undefined,
  );

  return (
    <form action={formAction} className="grid grid-cols-1 gap-3 sm:grid-cols-[120px_1fr_100px_auto]">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-slate-700">
          Code
        </label>
        <input
          id="code"
          name="code"
          placeholder="CSC301"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="title" className="block text-sm font-medium text-slate-700">
          Title
        </label>
        <input
          id="title"
          name="title"
          placeholder="Data Structures"
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div>
        <label htmlFor="creditUnits" className="block text-sm font-medium text-slate-700">
          Units
        </label>
        <input
          id="creditUnits"
          name="creditUnits"
          type="number"
          min={1}
          max={12}
          defaultValue={3}
          required
          className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
        />
      </div>
      <div className="flex items-end">
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
        >
          {pending ? "Adding..." : "Add course"}
        </button>
      </div>
      {state?.error && (
        <p role="alert" className="col-span-full text-sm text-red-600">
          {state.error}
        </p>
      )}
    </form>
  );
}
