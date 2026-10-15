import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskInputSchema } from "@/lib/tasks/validation";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { mobileMutationObjectId, readMobileMutationId } from "@/lib/mobile/mutation-id";
import { notifyTaskChange } from "@/lib/mobile/push-notifications";

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function GET(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  await connectToDatabase();
  const tasks = await Task.find({ userId: principal.userId })
    .sort({ dueDate: 1, createdAt: -1 })
    .populate<{ courseId: { _id: Types.ObjectId; code: string } | null }>("courseId", "code")
    .lean();

  return NextResponse.json(tasks.map((task) => ({
    id: task._id.toString(),
    courseId: task.courseId?._id.toString() ?? null,
    title: task.title,
    description: task.description,
    type: task.type,
    priority: task.priority,
    status: task.status,
    dueDate: task.dueDate?.toISOString() ?? null,
    courseCode: task.courseId?.code ?? null,
  })), { headers });
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = TaskInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid task" }, { status: 400, headers });
  }
  const mutationId = readMobileMutationId(request);
  if (mutationId === false) {
    return NextResponse.json({ error: "Invalid mutation id" }, { status: 400, headers });
  }

  await connectToDatabase();
  const input = parsed.data;
  if (!(await courseBelongsToUser(input.courseId, principal.userId))) {
    return NextResponse.json({ error: "Course not found" }, { status: 400, headers });
  }

  const taskValues = {
    userId: principal.userId,
    courseId: input.courseId ? new Types.ObjectId(input.courseId) : null,
    title: input.title,
    description: input.description || null,
    type: input.type,
    priority: input.priority,
    status: "todo" as const,
    dueDate: input.dueDate ? new Date(input.dueDate) : null,
    completedAt: null,
  };
  let task = mutationId
    ? await Task.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId })
    : null;
  if (!task) {
    let created = false;
    try {
      task = await Task.create({ _id: mobileMutationObjectId(mutationId), ...taskValues });
      created = true;
    } catch (error) {
      if (!mutationId || !(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      task = await Task.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId });
      if (!task) throw error;
    }
    if (created && mutationId && task) {
      await notifyTaskChange(
        principal.userId,
        "New task",
        task.title,
        task._id.toString(),
        request.headers.get("x-catalysts-device-token"),
      );
    }
  }

  return NextResponse.json({ id: task._id.toString(), title: task.title, status: task.status }, { status: 201, headers });
}
