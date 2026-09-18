"use client";

import { setCurrentAcademicYear } from "@/lib/actions/academic-years";

export function SetCurrentYearButton({ yearId }: { yearId: string }) {
  return (
    <form action={setCurrentAcademicYear.bind(null, yearId)}>
      <button
        type="submit"
        className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:bg-slate-50"
      >
        Set as current
      </button>
    </form>
  );
}
