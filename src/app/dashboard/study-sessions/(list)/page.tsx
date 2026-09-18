import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudySession } from "@/models/StudySession";
import { formatDuration, minutesBetween, minutesOnDay, totalMinutes } from "@/lib/study-sessions/summary";
import { lastNDays } from "@/lib/habits/streak";
import { DeleteSessionButton } from "../delete-session-button";

interface SessionLean {
  _id: Types.ObjectId;
  date: Date;
  durationMinutes: number;
  notes: string | null;
  courseId: { _id: Types.ObjectId; code: string; title: string } | null;
}

function formatSessionDate(date: Date): string {
  return new Date(date).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export default async function StudySessionsPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const sessions = await StudySession.find({ userId })
    .populate("courseId", "code title")
    .sort({ date: -1, createdAt: -1 })
    .lean<SessionLean[]>();

  const now = new Date();
  const weekStart = lastNDays(7, now)[0];

  const today = formatDuration(minutesOnDay(sessions, now));
  const thisWeek = formatDuration(minutesBetween(sessions, weekStart, now));
  const allTime = formatDuration(totalMinutes(sessions));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-slate-900">Study sessions</h1>
        <Link
          href="/dashboard/study-sessions/new"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
        >
          Log session
        </Link>
      </div>

      {sessions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-base font-semibold text-slate-900">No study sessions yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Log your study time to see your totals and track your progress.
          </p>
          <Link
            href="/dashboard/study-sessions/new"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
          >
            Log your first session
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <StatCard label="Today" value={today} />
            <StatCard label="This week" value={thisWeek} />
            <StatCard label="All time" value={allTime} />
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white p-6">
            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session._id.toString()}
                  className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3 last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/study-sessions/${session._id.toString()}/edit`}
                        className="font-medium text-slate-900 hover:text-indigo-600"
                      >
                        {formatSessionDate(session.date)}
                      </Link>
                      <span className="text-sm text-slate-500">
                        {formatDuration(session.durationMinutes)}
                      </span>
                      {session.courseId && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                          {session.courseId.code}
                        </span>
                      )}
                    </div>
                    {session.notes && (
                      <p className="mt-1 max-w-lg truncate text-sm text-slate-500">
                        {session.notes}
                      </p>
                    )}
                  </div>
                  <DeleteSessionButton sessionId={session._id.toString()} />
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}
