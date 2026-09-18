"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";

export type ActionState = { error?: string } | undefined;

const AcademicYearSchema = z.object({
  label: z.string().trim().min(2, "Label must be at least 2 characters").max(50),
});

export async function createAcademicYear(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId();

  const parsed = AcademicYearSchema.safeParse({ label: formData.get("label") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message };
  }

  await connectToDatabase();

  const existing = await AcademicYear.findOne({ userId, label: parsed.data.label });
  if (existing) {
    return { error: "You already have an academic year with this label" };
  }

  const isFirst = (await AcademicYear.countDocuments({ userId })) === 0;
  const year = await AcademicYear.create({
    userId,
    label: parsed.data.label,
    isCurrent: isFirst,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/academic-years");
  redirect(`/dashboard/academic-years/${year._id.toString()}`);
}

export async function setCurrentAcademicYear(yearId: string): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();

  const year = await AcademicYear.findOne({ _id: yearId, userId });
  if (!year) {
    return;
  }

  await AcademicYear.updateMany({ userId }, { isCurrent: false });
  await AcademicYear.updateOne({ _id: yearId }, { isCurrent: true });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/academic-years");
}
