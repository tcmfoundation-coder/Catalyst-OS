import { NextResponse } from "next/server";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { connectToDatabase } from "@/lib/db";
import { Habit } from "@/models/Habit";
import { HabitInputSchema } from "@/lib/habits/validation";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { mobileMutationObjectId, readMobileMutationId } from "@/lib/mobile/mutation-id";

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function POST(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const parsed = HabitInputSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid habit" }, { status: 400, headers });
  }
  const mutationId = readMobileMutationId(request);
  if (mutationId === false) return NextResponse.json({ error: "Invalid mutation id" }, { status: 400, headers });

  await connectToDatabase();
  const values = {
    userId: principal.userId,
    name: parsed.data.name,
    description: parsed.data.description || null,
  };
  let habit = mutationId
    ? await Habit.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId })
    : null;
  if (!habit) {
    try {
      habit = await Habit.create({ _id: mobileMutationObjectId(mutationId), ...values });
    } catch (error) {
      if (!mutationId || !(error && typeof error === "object" && "code" in error && error.code === 11000)) throw error;
      habit = await Habit.findOne({ _id: mobileMutationObjectId(mutationId), userId: principal.userId });
      if (!habit) throw error;
    }
  }

  return NextResponse.json({ id: habit._id.toString(), name: habit.name }, { status: 201, headers });
}
