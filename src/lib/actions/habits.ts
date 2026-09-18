"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Habit } from "@/models/Habit";
import { HabitLog } from "@/models/HabitLog";
import { HabitInputSchema } from "@/lib/habits/validation";

export type ActionState = { error?: string } | undefined;

function readHabitInput(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    description: String(formData.get("description") ?? ""),
  };
}

export async function createHabit(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = HabitInputSchema.safeParse(readHabitInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  await Habit.create({
    userId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  });

  revalidatePath("/dashboard/habits");
  revalidatePath("/dashboard");
  redirect("/dashboard/habits");
}

export async function updateHabit(
  habitId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = HabitInputSchema.safeParse(readHabitInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const habit = await Habit.findOne({ _id: habitId, userId });
  if (!habit) {
    return { error: "Habit not found" };
  }

  habit.name = parsed.data.name;
  habit.description = parsed.data.description || null;
  await habit.save();

  revalidatePath("/dashboard/habits");
  revalidatePath("/dashboard");
  redirect("/dashboard/habits");
}

export async function deleteHabit(habitId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const habit = await Habit.findOneAndDelete({ _id: habitId, userId });
  if (habit) {
    await HabitLog.deleteMany({ habitId: habit._id });
  }

  revalidatePath("/dashboard/habits");
  revalidatePath("/dashboard");
}

/** Toggles whether a habit was completed on a given calendar day (creates or removes that day's log). */
export async function toggleHabitLog(habitId: string, dateISO: string): Promise<void> {
  const userId = await requireUserId();

  if (Number.isNaN(Date.parse(dateISO))) return;

  await connectToDatabase();

  const habit = await Habit.findOne({ _id: habitId, userId }).select("_id");
  if (!habit) return;

  const date = new Date(dateISO);
  const existing = await HabitLog.findOne({ habitId, date });
  if (existing) {
    await HabitLog.deleteOne({ _id: existing._id });
  } else {
    await HabitLog.create({ userId, habitId, date });
  }

  revalidatePath("/dashboard/habits");
  revalidatePath("/dashboard");
}
