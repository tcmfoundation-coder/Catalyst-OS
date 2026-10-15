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
    <section className="hud-panel rounded-2xl p-5 sm:p-6">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Focus telemetry</h2>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs font-medium text-muted">Study today</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{studyToday}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">This week</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{studyThisWeek}</p>
        </div>
        <div>
          <p className="text-xs font-medium text-muted">Habits today</p>
          <p className="mt-1 text-lg font-semibold text-foreground">
            {totalHabits === 0 ? "—" : `${habitsCompletedToday}/${totalHabits}`}
          </p>
        </div>
      </div>
      <div className="mt-4 flex gap-4 text-sm">
        <Link
          href="/dashboard/study-sessions"
          className="font-medium text-accent hover:underline"
        >
          Log study time
        </Link>
        <Link href="/dashboard/habits" className="font-medium text-accent hover:underline">
          View habits
        </Link>
      </div>
    </section>
  );
}
