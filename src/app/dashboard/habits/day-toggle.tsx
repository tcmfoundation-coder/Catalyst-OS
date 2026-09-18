"use client";

import { toggleHabitLog } from "@/lib/actions/habits";

export function DayToggle({
  habitId,
  dateISO,
  label,
  completed,
  isToday,
}: {
  habitId: string;
  dateISO: string;
  label: string;
  completed: boolean;
  isToday: boolean;
}) {
  return (
    <form action={toggleHabitLog.bind(null, habitId, dateISO)}>
      <button
        type="submit"
        aria-label={`${completed ? "Unmark" : "Mark"} ${label} as done`}
        title={label}
        className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-medium transition ${
          completed
            ? "border-indigo-600 bg-indigo-600 text-white hover:bg-indigo-700"
            : "border-slate-300 bg-white text-slate-400 hover:border-indigo-400"
        } ${isToday ? "ring-2 ring-indigo-200 ring-offset-1" : ""}`}
      >
        {label[0]}
      </button>
    </form>
  );
}
