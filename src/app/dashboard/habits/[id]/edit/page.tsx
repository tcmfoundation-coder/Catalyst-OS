import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Habit } from "@/models/Habit";
import { updateHabit } from "@/lib/actions/habits";
import { HabitForm } from "../../habit-form";

export default async function EditHabitPage({
  params,
}: PageProps<"/dashboard/habits/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const habit = await Habit.findOne({ _id: id, userId }).lean();
  if (!habit) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Edit habit</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <HabitForm
          action={updateHabit.bind(null, id)}
          submitLabel="Save changes"
          cancelHref="/dashboard/habits"
          defaultValues={{ name: habit.name, description: habit.description ?? "" }}
        />
      </div>
    </div>
  );
}
