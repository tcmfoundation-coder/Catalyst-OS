"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { LearningMemory } from "@/models/LearningMemory";
import { LearningMemoryInputSchema } from "@/lib/learning-memories/validation";
import { courseBelongsToUser } from "./course-ownership";

export type ActionState = { error?: string } | undefined;

function readMemoryInput(formData: FormData) {
  return {
    content: String(formData.get("content") ?? ""),
    category: String(formData.get("category") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
  };
}

export async function createLearningMemory(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = LearningMemoryInputSchema.safeParse(readMemoryInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const { content, category, courseId } = parsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  await LearningMemory.create({
    userId,
    courseId: courseId ? new Types.ObjectId(courseId) : null,
    content,
    category,
  });

  revalidatePath("/dashboard/memories");
  revalidatePath("/dashboard");
  redirect("/dashboard/memories");
}

export async function updateLearningMemory(
  memoryId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = LearningMemoryInputSchema.safeParse(readMemoryInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const memory = await LearningMemory.findOne({ _id: memoryId, userId });
  if (!memory) {
    return { error: "Memory not found" };
  }

  const { content, category, courseId } = parsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  memory.content = content;
  memory.category = category;
  memory.courseId = courseId ? new Types.ObjectId(courseId) : null;
  await memory.save();

  revalidatePath("/dashboard/memories");
  revalidatePath("/dashboard");
  redirect("/dashboard/memories");
}

export async function deleteLearningMemory(memoryId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  await LearningMemory.findOneAndDelete({ _id: memoryId, userId });

  revalidatePath("/dashboard/memories");
  revalidatePath("/dashboard");
}
