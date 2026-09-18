"use client";

import { deleteHabit } from "@/lib/actions/habits";

export function DeleteHabitButton({ habitId }: { habitId: string }) {
  return (
    <form action={deleteHabit.bind(null, habitId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Delete
      </button>
    </form>
  );
}
