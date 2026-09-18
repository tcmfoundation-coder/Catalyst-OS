"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";
import { Semester } from "@/models/Semester";

export type ActionState = { error?: string } | undefined;

const SemesterSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(50),
});

export async function createSemester(
  academicYearId: string,
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = SemesterSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const academicYear = await AcademicYear.findOne({ _id: academicYearId, userId });
  if (!academicYear) {
    return { error: "Academic year not found" };
  }

  const existing = await Semester.findOne({ academicYearId, name: parsed.data.name });
  if (existing) {
    return { error: "This academic year already has a semester with this name" };
  }

  const order = await Semester.countDocuments({ academicYearId });
  const isFirst = (await Semester.countDocuments({ userId })) === 0;

  const semester = await Semester.create({
    userId,
    academicYearId,
    name: parsed.data.name,
    order,
    isCurrent: isFirst,
  });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/academic-years/${academicYearId}`);
  redirect(`/dashboard/semesters/${semester._id.toString()}`);
}

export async function setCurrentSemester(semesterId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const semester = await Semester.findOne({ _id: semesterId, userId });
  if (!semester) {
    return;
  }

  await Semester.updateMany({ userId }, { isCurrent: false });
  await Semester.updateOne({ _id: semesterId }, { isCurrent: true });

  revalidatePath("/dashboard");
  revalidatePath(`/dashboard/academic-years/${semester.academicYearId.toString()}`);
  revalidatePath(`/dashboard/semesters/${semesterId}`);
}
