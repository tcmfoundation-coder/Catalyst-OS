"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { Course } from "@/models/Course";
import { TaskInputSchema, TaskStatusInputSchema } from "@/lib/tasks/validation";
import { nextCompletedAt } from "@/lib/tasks/lifecycle";

export type ActionState = { error?: string } | undefined;

function readTaskInput(formData: FormData) {
  return {
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
    type: String(formData.get("type") ?? ""),
    priority: String(formData.get("priority") ?? ""),
    dueDate: String(formData.get("dueDate") ?? ""),
    courseId: String(formData.get("courseId") ?? ""),
  };
}

/** A task doesn't have to belong to a course, but if it does, that course must be the caller's own. */
async function courseBelongsToUser(courseId: string, userId: string): Promise<boolean> {
  if (!courseId) return true;
  const course = await Course.findOne({ _id: courseId, userId }).select("_id");
  return Boolean(course);
}

export async function createTask(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = TaskInputSchema.safeParse(readTaskInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const { title, description, type, priority, dueDate, courseId } = parsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  await Task.create({
    userId,
    courseId: courseId ? new Types.ObjectId(courseId) : null,
    title,
    description: description || null,
    type,
    priority,
    status: "todo",
    dueDate: dueDate ? new Date(dueDate) : null,
    completedAt: null,
  });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  redirect("/dashboard/tasks");
}

export async function updateTask(
  taskId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const inputParsed = TaskInputSchema.safeParse(readTaskInput(formData));
  if (!inputParsed.success) {
    return { error: inputParsed.error.issues[0]?.message };
  }

  const statusParsed = TaskStatusInputSchema.safeParse({ status: formData.get("status") });
  if (!statusParsed.success) {
    return { error: statusParsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) {
    return { error: "Task not found" };
  }

  const { title, description, type, priority, dueDate, courseId } = inputParsed.data;

  if (!(await courseBelongsToUser(courseId, userId))) {
    return { error: "Course not found" };
  }

  task.title = title;
  task.description = description || null;
  task.type = type;
  task.priority = priority;
  task.dueDate = dueDate ? new Date(dueDate) : null;
  task.courseId = courseId ? new Types.ObjectId(courseId) : null;
  task.completedAt = nextCompletedAt(statusParsed.data.status, task.status, task.completedAt);
  task.status = statusParsed.data.status;
  await task.save();

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
  redirect("/dashboard/tasks");
}

export async function deleteTask(taskId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  await Task.findOneAndDelete({ _id: taskId, userId });

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function completeTask(taskId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) return;

  task.completedAt = nextCompletedAt("completed", task.status, task.completedAt);
  task.status = "completed";
  await task.save();

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}

export async function reopenTask(taskId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const task = await Task.findOne({ _id: taskId, userId });
  if (!task) return;

  task.status = "todo";
  task.completedAt = null;
  await task.save();

  revalidatePath("/dashboard/tasks");
  revalidatePath("/dashboard");
}
