import { NextResponse } from "next/server";
import { Types } from "mongoose";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { TaskInputSchema, TaskStatusInputSchema } from "@/lib/tasks/validation";
import { nextCompletedAt } from "@/lib/tasks/lifecycle";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { notifyTaskChange } from "@/lib/mobile/push-notifications";

type RouteContext = { params: Promise<{ id: string }> };

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Task not found" }, { status: 404, headers });
  const body: unknown = await request.json().catch(() => null);
  const statusOnly = TaskStatusInputSchema.safeParse(body);
  const isStatusOnly = statusOnly.success
    && typeof body === "object"
    && body !== null
    && Object.keys(body).length === 1
    && "status" in body;
  const editParsed = isStatusOnly
    ? null
    : TaskInputSchema.extend({ status: TaskStatusInputSchema.shape.status.optional() }).safeParse(body);
  if (!isStatusOnly && !editParsed?.success) {
    return NextResponse.json(
      { error: editParsed && !editParsed.success ? editParsed.error.issues[0]?.message : "Invalid task" },
      { status: 400, headers },
    );
  }

  await connectToDatabase();
  const task = await Task.findOne({ _id: id, userId: principal.userId });
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404, headers });

  let changed = false;
  if (isStatusOnly && statusOnly.success) {
    changed = task.status !== statusOnly.data.status;
    task.completedAt = nextCompletedAt(statusOnly.data.status, task.status, task.completedAt);
    task.status = statusOnly.data.status;
  } else if (editParsed?.success) {
    const input = editParsed.data;
    if (!(await courseBelongsToUser(input.courseId, principal.userId))) {
      return NextResponse.json({ error: "Course not found" }, { status: 400, headers });
    }
    changed = task.title !== input.title
      || task.description !== (input.description || null)
      || task.type !== input.type
      || task.priority !== input.priority
      || task.dueDate?.toISOString() !== (input.dueDate ? new Date(input.dueDate).toISOString() : undefined)
      || task.courseId?.toString() !== (input.courseId || undefined)
      || (input.status !== undefined && task.status !== input.status);
    task.title = input.title;
    task.description = input.description || null;
    task.type = input.type;
    task.priority = input.priority;
    task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    task.courseId = input.courseId ? new Types.ObjectId(input.courseId) : null;
    if (input.status) {
      task.completedAt = nextCompletedAt(input.status, task.status, task.completedAt);
      task.status = input.status;
    }
  }
  if (changed) {
    await task.save();
    await notifyTaskChange(
      principal.userId,
      "Task updated",
      task.title,
      task._id.toString(),
      request.headers.get("x-catalysts-device-token"),
    );
  }

  return NextResponse.json({ id: task._id.toString(), title: task.title, status: task.status }, { headers });
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const { id } = await params;
  if (!Types.ObjectId.isValid(id)) return NextResponse.json({ error: "Task not found" }, { status: 404, headers });

  await connectToDatabase();
  const task = await Task.findOneAndDelete({ _id: id, userId: principal.userId });
  if (task) {
    await notifyTaskChange(
      principal.userId,
      "Task deleted",
      task.title,
      task._id.toString(),
      request.headers.get("x-catalysts-device-token"),
    );
  }

  return new Response(null, { status: 204, headers });
}
