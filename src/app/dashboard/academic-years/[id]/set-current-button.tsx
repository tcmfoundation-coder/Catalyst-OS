"use client";

import { setCurrentSemester } from "@/lib/actions/semesters";

export function SetCurrentSemesterButton({ semesterId }: { semesterId: string }) {
  return (
    <form action={setCurrentSemester.bind(null, semesterId)}>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Set as current
      </button>
    </form>
  );
}
