import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Habit } from "@/models/Habit";
import { HabitLog } from "@/models/HabitLog";
import { calculateStreaks, lastNDays, toDayKey } from "@/lib/habits/streak";
import { DayToggle } from "../day-toggle";
import { DeleteHabitButton } from "../delete-habit-button";

interface HabitLean {
  _id: Types.ObjectId;
  name: string;
  description: string | null;
}

interface HabitLogLean {
  habitId: Types.ObjectId;
  date: Date;
}

export default async function HabitsPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const [habits, logs] = await Promise.all([
    Habit.find({ userId }).sort({ createdAt: 1 }).lean<HabitLean[]>(),
    HabitLog.find({ userId }).select("habitId date").lean<HabitLogLean[]>(),
  ]);

  const now = new Date();
  const week = lastNDays(7, now);

  const logsByHabit = new Map<string, Date[]>();
  for (const log of logs) {
    const key = log.habitId.toString();
    const list = logsByHabit.get(key) ?? [];
    list.push(log.date);
    logsByHabit.set(key, list);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Habits</h1>
        <Link
          href="/dashboard/habits/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          New habit
        </Link>
      </div>

      {habits.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No habits yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Add a habit to start building a daily streak.
          </p>
          <Link
            href="/dashboard/habits/new"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Add your first habit
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => {
            const habitId = habit._id.toString();
            const habitDates = logsByHabit.get(habitId) ?? [];
            const habitDayKeys = new Set(habitDates.map(toDayKey));
            const { currentStreak, longestStreak } = calculateStreaks(habitDates, now);

            return (
              <div key={habitId} className="rounded-2xl border border-slate-200 bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/habits/${habitId}/edit`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {habit.name}
                      </Link>
                      {currentStreak > 0 && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
                          {currentStreak}-day streak
                        </span>
                      )}
                    </div>
                    {habit.description && (
                      <p className="mt-1 text-sm text-slate-500">{habit.description}</p>
                    )}
                    <p className="mt-1 text-xs text-slate-400">
                      Longest streak: {longestStreak} day{longestStreak === 1 ? "" : "s"}
                    </p>
                  </div>
                  <DeleteHabitButton habitId={habitId} />
                </div>
                <div className="mt-4 flex items-center gap-2">
                  {week.map((day) => {
                    const dateISO = day.toISOString().slice(0, 10);
                    return (
                      <DayToggle
                        key={dateISO}
                        habitId={habitId}
                        dateISO={dateISO}
                        label={day.toLocaleDateString(undefined, {
                          timeZone: "UTC",
                          weekday: "short",
                        })}
                        completed={habitDayKeys.has(toDayKey(day))}
                        isToday={toDayKey(day) === toDayKey(now)}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
