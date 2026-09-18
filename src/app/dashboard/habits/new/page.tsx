import { createHabit } from "@/lib/actions/habits";
import { HabitForm } from "../habit-form";

export default function NewHabitPage() {
  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">New habit</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <HabitForm action={createHabit} submitLabel="Add habit" cancelHref="/dashboard/habits" />
      </div>
    </div>
  );
}
