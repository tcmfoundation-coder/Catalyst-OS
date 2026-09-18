import Link from "next/link";

export function StudyHabitsWidget({
  studyToday,
  studyThisWeek,
  habitsCompletedToday,
  totalHabits,
}: {
  studyToday: string;
  studyThisWeek: string;
  habitsCompletedToday: number;
  totalHabits: number;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="mb-4 text-base font-semibold text-slate-900">Study &amp; habits</h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-slate-400">Study today</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{studyToday}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">This week</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">{studyThisWeek}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-slate-400">Habits today</p>
          <p className="mt-1 text-lg font-semibold text-slate-900">
            {totalHabits === 0 ? "—" : `${habitsCompletedToday}/${totalHabits}`}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <Link
          href="/dashboard/study-sessions"
          className="font-medium text-indigo-600 hover:underline"
        >
          Log study time
        </Link>
        <Link href="/dashboard/habits" className="font-medium text-indigo-600 hover:underline">
          View habits
        </Link>
      </div>
    </section>
  );
}
