import { NextResponse } from "next/server";
import { z } from "zod";
import { Types } from "mongoose";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";
import { Semester } from "@/models/Semester";
import { Course } from "@/models/Course";
import { isValidGrade } from "@/lib/academic/grading-scale";

export function OPTIONS(request: Request) { return mobileApiOptions(request); }
export async function GET(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  await connectToDatabase();
  const [years, semesters, courses] = await Promise.all([
    AcademicYear.find({ userId: principal.userId }).sort({ createdAt: 1 }).lean(),
    Semester.find({ userId: principal.userId }).sort({ order: 1 }).lean(),
    Course.find({ userId: principal.userId }).sort({ code: 1 }).lean(),
  ]);
  return NextResponse.json({ years: years.map(y => ({ id: y._id.toString(), label: y.label, isCurrent: y.isCurrent })),
    semesters: semesters.map(s => ({ id: s._id.toString(), academicYearId: s.academicYearId.toString(), name: s.name, isCurrent: s.isCurrent })),
    courses: courses.map(c => ({ id: c._id.toString(), semesterId: c.semesterId.toString(), code: c.code, title: c.title, creditUnits: c.creditUnits, grade: c.grade })) }, { headers });
}
const bodySchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("year"), label: z.string().trim().min(2).max(50) }),
  z.object({ action: z.literal("semester"), academicYearId: z.string(), name: z.string().trim().min(2).max(50) }),
  z.object({ action: z.literal("course"), semesterId: z.string(), code: z.string().trim().min(2).max(20), title: z.string().trim().min(2).max(120), creditUnits: z.coerce.number().int().min(1).max(12) }),
  z.object({ action: z.literal("currentYear"), id: z.string() }),
  z.object({ action: z.literal("currentSemester"), id: z.string() }),
  z.object({ action: z.literal("grade"), id: z.string(), grade: z.string().trim().toUpperCase() }),
]);
export async function POST(request: Request) {
  const headers = mobileApiHeaders(request), principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400, headers });
  await connectToDatabase(); const { userId } = principal, input = parsed.data;
  if (input.action === "year") {
    if (await AcademicYear.exists({ userId, label: input.label })) return NextResponse.json({ error: "You already have an academic year with this label" }, { status: 400, headers });
    const isCurrent = !(await AcademicYear.exists({ userId })); await AcademicYear.create({ userId, label: input.label, isCurrent });
  } else if (input.action === "semester") {
    if (!Types.ObjectId.isValid(input.academicYearId) || !(await AcademicYear.exists({ _id: input.academicYearId, userId }))) return NextResponse.json({ error: "Academic year not found" }, { status: 400, headers });
    if (await Semester.exists({ academicYearId: input.academicYearId, name: input.name })) return NextResponse.json({ error: "This academic year already has a semester with this name" }, { status: 400, headers });
    await Semester.create({ userId, academicYearId: input.academicYearId, name: input.name, order: await Semester.countDocuments({ academicYearId: input.academicYearId }), isCurrent: !(await Semester.exists({ userId })) });
  } else if (input.action === "course") {
    if (!Types.ObjectId.isValid(input.semesterId) || !(await Semester.exists({ _id: input.semesterId, userId }))) return NextResponse.json({ error: "Semester not found" }, { status: 400, headers });
    const code = input.code.toUpperCase(); if (await Course.exists({ semesterId: input.semesterId, code })) return NextResponse.json({ error: `A course with code "${code}" already exists in this semester` }, { status: 400, headers });
    await Course.create({ userId, semesterId: input.semesterId, code, title: input.title, creditUnits: input.creditUnits, grade: null });
  } else if (input.action === "currentYear") {
    if (!Types.ObjectId.isValid(input.id) || !(await AcademicYear.exists({ _id: input.id, userId }))) return NextResponse.json({ error: "Academic year not found" }, { status: 404, headers });
    await AcademicYear.updateMany({ userId }, { isCurrent: false }); await AcademicYear.updateOne({ _id: input.id, userId }, { isCurrent: true });
  } else if (input.action === "currentSemester") {
    if (!Types.ObjectId.isValid(input.id) || !(await Semester.exists({ _id: input.id, userId }))) return NextResponse.json({ error: "Semester not found" }, { status: 404, headers });
    await Semester.updateMany({ userId }, { isCurrent: false }); await Semester.updateOne({ _id: input.id, userId }, { isCurrent: true });
  } else {
    if (!Types.ObjectId.isValid(input.id) || !(input.grade === "" || isValidGrade(input.grade))) return NextResponse.json({ error: "Not a recognized grade" }, { status: 400, headers });
    const course = await Course.findOne({ _id: input.id, userId }); if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404, headers });
    course.grade = input.grade || null; await course.save();
  }
  return NextResponse.json({ ok: true }, { headers });
}
