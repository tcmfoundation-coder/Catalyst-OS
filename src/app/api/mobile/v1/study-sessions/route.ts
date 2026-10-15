import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { connectToDatabase } from "@/lib/db";
import { StudySession } from "@/models/StudySession";
import { StudySessionInputSchema } from "@/lib/study-sessions/validation";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = StudySessionInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid study session" }, { status: 400, headers });
  }

  await connectToDatabase();
  const input = parsed.data;
  if (!(await courseBelongsToUser(input.courseId, principal.userId))) {
    return NextResponse.json({ error: "Course not found" }, { status: 400, headers });
  }

  const session = await StudySession.create({
    userId: principal.userId,
    courseId: input.courseId ? new Types.ObjectId(input.courseId) : null,
    date: new Date(input.date),
    durationMinutes: input.durationMinutes,
    notes: input.notes || null,
  });

  return NextResponse.json({ id: session._id.toString(), durationMinutes: session.durationMinutes }, { status: 201, headers });
}
