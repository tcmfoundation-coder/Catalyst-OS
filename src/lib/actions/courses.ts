"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Course } from "@/models/Course";
import { Semester } from "@/models/Semester";
import { isValidGrade } from "@/lib/academic/grading-scale";

export type ActionState = { error?: string } | undefined;

const CourseSchema = z.object({
  code: z.string().trim().min(2, "Course code is required").max(20),
  title: z.string().trim().min(2, "Course title is required").max(120),
  creditUnits: z.coerce.number().int().min(1, "Credit units must be at least 1").max(12),
});

export async function createCourse(
  semesterId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = CourseSchema.safeParse({
    code: formData.get("code"),
    title: formData.get("title"),
    creditUnits: formData.get("creditUnits"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const semester = await Semester.findOne({ _id: semesterId, userId });
  if (!semester) {
    return { error: "Semester not found" };
  }

  const code = parsed.data.code.toUpperCase();
  const existing = await Course.findOne({ semesterId, code });
  if (existing) {
    return { error: `A course with code "${code}" already exists in this semester` };
  }

  await Course.create({
    userId,
    semesterId,
    code,
    title: parsed.data.title,
    creditUnits: parsed.data.creditUnits,
    grade: null,
  });

  revalidatePath(`/dashboard/semesters/${semesterId}`);
  revalidatePath("/dashboard");
}

const GradeSchema = z.object({
  grade: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === "" || isValidGrade(value), "Not a recognized grade"),
});

export async function updateCourseGrade(
  courseId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = GradeSchema.safeParse({ grade: formData.get("grade") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const course = await Course.findOne({ _id: courseId, userId });
  if (!course) {
    return { error: "Course not found" };
  }

  course.grade = parsed.data.grade === "" ? null : parsed.data.grade;
  await course.save();

  revalidatePath(`/dashboard/semesters/${course.semesterId.toString()}`);
  revalidatePath("/dashboard");
}

export async function deleteCourse(courseId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const course = await Course.findOneAndDelete({ _id: courseId, userId });
  if (course) {
    revalidatePath(`/dashboard/semesters/${course.semesterId.toString()}`);
    revalidatePath("/dashboard");
  }
}
