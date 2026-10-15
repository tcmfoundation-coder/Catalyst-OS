import Link from "next/link";
import type { Types } from "mongoose";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { AcademicYear } from "@/models/AcademicYear";
import { Semester } from "@/models/Semester";
import { Course } from "@/models/Course";
import { Task, type ITask } from "@/models/Task";
import { StudySession } from "@/models/StudySession";
import { Habit } from "@/models/Habit";
import { HabitLog } from "@/models/HabitLog";
import { LearningMemory } from "@/models/LearningMemory";
import { calculateCGPA, calculateSemesterGPA } from "@/lib/academic/gpa";
import { compareTasks } from "@/lib/tasks/sort";
import { formatDuration, minutesBetween, minutesOnDay } from "@/lib/study-sessions/summary";
import { lastNDays } from "@/lib/habits/streak";
import { UpcomingTasksWidget, type UpcomingTaskData } from "./upcoming-tasks-widget";
import { StudyHabitsWidget } from "./study-habits-widget";
import { RecentMemoriesWidget, type RecentMemoryData } from "./recent-memories-widget";

const RECENT_MEMORIES_LIMIT = 3;

interface CourseLean {
  _id: Types.ObjectId;
  semesterId: Types.ObjectId;
  code: string;
  title: string;
  creditUnits: number;
  grade: string | null;
}

interface UpcomingTaskLean {
  _id: Types.ObjectId;
  title: string;
  status: ITask["status"];
  dueDate: Date | null;
  courseId: { code: string } | null;
}

const UPCOMING_TASKS_LIMIT = 5;

export default async function DashboardPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const now = new Date();
  const todayUtcMidnight = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );

  const [
    currentYear,
    currentSemester,
    allCourses,
    incompleteTasks,
    studySessions,
    totalHabits,
    habitsCompletedToday,
    recentMemories,
  ] = await Promise.all([
    AcademicYear.findOne({ userId, isCurrent: true }).lean(),
    Semester.findOne({ userId, isCurrent: true }).lean(),
    Course.find({ userId }).lean<CourseLean[]>(),
    Task.find({ userId, status: { $ne: "completed" } })
      .populate("courseId", "code")
      .lean<UpcomingTaskLean[]>(),
    StudySession.find({ userId }).select("date durationMinutes").lean(),
    Habit.countDocuments({ userId }),
    HabitLog.countDocuments({ userId, date: todayUtcMidnight }),
    LearningMemory.find({ userId })
      .select("content category")
      .sort({ createdAt: -1 })
      .limit(RECENT_MEMORIES_LIMIT)
      .lean(),
  ]);

  const studyToday = formatDuration(minutesOnDay(studySessions, now));
  const studyThisWeek = formatDuration(minutesBetween(studySessions, lastNDays(7, now)[0], now));

  const memories: RecentMemoryData[] = recentMemories.map((memory) => ({
    id: memory._id.toString(),
    content: memory.content,
    category: memory.category,
  }));

  const upcomingTasks: UpcomingTaskData[] = [...incompleteTasks]
    .sort((a, b) =>
      compareTasks("dueDate")(
        { dueDate: a.dueDate, priority: "medium", courseTitle: null },
        { dueDate: b.dueDate, priority: "medium", courseTitle: null },
      ),
    )
    .slice(0, UPCOMING_TASKS_LIMIT)
    .map((task) => ({
      id: task._id.toString(),
      title: task.title,
      dueDate: task.dueDate,
      status: task.status,
      courseCode: task.courseId?.code ?? null,
    }));

  const currentSemesterCourses = currentSemester
    ? allCourses.filter(
        (course) => course.semesterId.toString() === currentSemester._id.toString(),
      )
    : [];

  const cgpa = calculateCGPA(
    allCourses.map((course) => ({ creditUnits: course.creditUnits, grade: course.grade })),
  );
  const semesterGpa = calculateSemesterGPA(
    currentSemesterCourses.map((course) => ({
      creditUnits: course.creditUnits,
      grade: course.grade,
    })),
  );

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  if (!currentYear) {
    return (
      <div className="dashboard-grid space-y-6 rounded-3xl p-1 sm:p-3">
        <div className="hud-panel relative overflow-hidden rounded-3xl p-8 text-center sm:p-12">
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-accent/70 to-transparent" />
          <p className="font-mono text-[10px] tracking-[0.24em] text-accent uppercase">System initialization · {today}</p>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            Let&apos;s set up your academics
          </h1>
          <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-muted">
            Create your first academic year to start tracking semesters, courses, and your GPA.
          </p>
          <Link
            href="/dashboard/academic-years"
            className="mt-7 inline-flex min-h-11 items-center rounded-lg border border-accent/40 bg-accent px-5 text-sm font-semibold text-[#10170c] transition hover:bg-[#bcff6e]"
          >
            Create academic year
          </Link>
        </div>
        <UpcomingTasksWidget tasks={upcomingTasks} />
        <StudyHabitsWidget
          studyToday={studyToday}
          studyThisWeek={studyThisWeek}
          habitsCompletedToday={habitsCompletedToday}
          totalHabits={totalHabits}
        />
        <RecentMemoriesWidget memories={memories} />
      </div>
    );
  }

  return (
    <div className="dashboard-grid space-y-5 rounded-3xl p-1 sm:p-3">
      <section className="hud-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
        <div className="absolute -right-12 -top-28 h-72 w-72 rounded-full border border-accent/10" />
        <div className="absolute -right-2 -top-16 h-52 w-52 rounded-full border border-accent/10" />
        <div className="absolute right-12 top-0 h-36 w-36 rounded-full bg-accent/5 blur-3xl" />
        <div className="relative">
          <p className="font-mono text-[10px] tracking-[0.24em] text-accent uppercase">Learning command · {today}</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
            {currentSemester ? currentSemester.name : currentYear.label}
          </h1>
          <p className="mt-2 text-sm text-muted">{currentSemester ? `Academic year ${currentYear.label}` : "Your academic system is online."}</p>
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-accent/20 bg-accent/5 px-3 py-1.5 font-mono text-[10px] tracking-[0.14em] text-accent uppercase">
            <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_10px_#a5f34b]" /> Academic system active
          </div>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard label="Cumulative GPA" value={cgpa.gpa.toFixed(2)} detail="ACADEMIC INDEX" />
        <StatCard label="Semester GPA" value={semesterGpa.gpa.toFixed(2)} detail="CURRENT CYCLE" />
        <StatCard label="Units completed" value={String(cgpa.completedCreditUnits)} detail="CREDITS BANKED" />
        <StatCard label="Units remaining" value={String(cgpa.remainingCreditUnits)} detail="TO COMPLETION" />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.35fr_0.85fr]">
        <div className="space-y-5">
          <UpcomingTasksWidget tasks={upcomingTasks} />
          <StudyHabitsWidget
            studyToday={studyToday}
            studyThisWeek={studyThisWeek}
            habitsCompletedToday={habitsCompletedToday}
            totalHabits={totalHabits}
          />
        </div>
        <div className="space-y-5">
          <RecentMemoriesWidget memories={memories} />
          <section className="hud-panel rounded-2xl p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Current courses</h2>
          {currentSemester && (
            <Link
              href={`/dashboard/semesters/${currentSemester._id.toString()}`}
              className="text-xs font-medium text-accent hover:underline"
            >
              Manage courses
            </Link>
          )}
        </div>
        {!currentSemester ? (
          <p className="text-sm text-muted">
            You haven&apos;t added a semester yet.{" "}
            <Link
              href={`/dashboard/academic-years/${currentYear._id.toString()}`}
              className="font-medium text-accent hover:underline"
            >
              Add one
            </Link>{" "}
            to start tracking courses.
          </p>
        ) : currentSemesterCourses.length === 0 ? (
          <p className="text-sm text-muted">
            No courses yet for this semester.{" "}
            <Link
              href={`/dashboard/semesters/${currentSemester._id.toString()}`}
              className="font-medium text-accent hover:underline"
            >
              Add your first course
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-[10px] tracking-wider text-muted uppercase">
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Units</th>
                <th className="pb-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {currentSemesterCourses.map((course) => (
                <tr key={course._id.toString()} className="border-b border-line/70 last:border-0">
                  <td className="py-3 font-mono text-xs font-semibold text-accent">{course.code}</td>
                  <td className="py-3 text-muted">{course.title}</td>
                  <td className="py-3 text-muted">{course.creditUnits}</td>
                  <td className="py-3 text-foreground">{course.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="hud-panel rounded-2xl p-4 sm:p-5">
      <p className="font-mono text-[9px] tracking-[0.16em] text-muted uppercase">{detail}</p>
      <p className="mt-3 text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-3xl font-semibold tracking-tight text-foreground">{value}</p>
    </div>
  );
}
