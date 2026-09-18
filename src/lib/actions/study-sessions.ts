"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudySession } from "@/models/StudySession";
import { StudySessionInputSchema } from "@/lib/study-sessions/validation";
import { courseBelongsToUser } from "./course-ownership";

export type ActionState = { error?: string } | undefined;

function readSessionInput(formData: FormData) {
  return {
    date: String(formData.get("date") ?? ""),
    durationMinutes: String(formData.get("durationMinutes") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  };
}

export async function createStudySession(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = StudySessionInputSchema.safeParse(readSessionInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const { date, durationMinutes, courseId, notes } = parsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  await StudySession.create({
    userId,
    courseId: courseId ? new Types.ObjectId(courseId) : null,
    date: new Date(date),
    durationMinutes,
    notes: notes || null,
  });

  revalidatePath("/dashboard/study-sessions");
  revalidatePath("/dashboard");
  redirect("/dashboard/study-sessions");
}

export async function updateStudySession(
  sessionId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = StudySessionInputSchema.safeParse(readSessionInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const session = await StudySession.findOne({ _id: sessionId, userId });
  if (!session) {
    return { error: "Study session not found" };
  }

  const { date, durationMinutes, courseId, notes } = parsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  session.date = new Date(date);
  session.durationMinutes = durationMinutes;
  session.courseId = courseId ? new Types.ObjectId(courseId) : null;
  session.notes = notes || null;
  await session.save();

  revalidatePath("/dashboard/study-sessions");
  revalidatePath("/dashboard");
  redirect("/dashboard/study-sessions");
}

export async function deleteStudySession(sessionId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  await StudySession.findOneAndDelete({ _id: sessionId, userId });

  revalidatePath("/dashboard/study-sessions");
  revalidatePath("/dashboard");
}
