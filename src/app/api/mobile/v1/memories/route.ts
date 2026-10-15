import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { connectToDatabase } from "@/lib/db";
import { LearningMemory } from "@/models/LearningMemory";
import { LearningMemoryInputSchema } from "@/lib/learning-memories/validation";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { mobileMutationObjectId, readMobileMutationId } from "@/lib/mobile/mutation-id";

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = LearningMemoryInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid memory" }, { status: 400, headers });
  }
  const mutationId = readMobileMutationId(request);
  if (mutationId === false) return NextResponse.json({ error: "Invalid mutation id" }, { status: 400, headers });

  await connectToDatabase();
  const input = parsed.data;
  if (!(await courseBelongsToUser(input.courseId, principal.userId))) {
    return NextResponse.json({ error: "Course not found" }, { status: 400, headers });
  }

  const values = {
    userId: principal.userId,
    courseId: input.courseId ? new Types.ObjectId(input.courseId) : null,
    content: input.content,
    category: input.category,
  };
  let memory = mutationId
    ? await LearningMemory.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId })
    : null;
  if (!memory) {
    try {
      memory = await LearningMemory.create({ _id: mobileMutationObjectId(mutationId), ...values });
    } catch (error) {
      if (!mutationId || !(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      memory = await LearningMemory.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId });
      if (!memory) throw error;
    }
  }

  return NextResponse.json({ id: memory._id.toString(), content: memory.content, category: memory.category }, { status: 201, headers });
}
