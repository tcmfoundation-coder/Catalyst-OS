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
import { calculateCGPA, calculateSemesterGPA } from "@/lib/academic/gpa";
import { compareTasks } from "@/lib/tasks/sort";
import { formatDuration, minutesBetween, minutesOnDay } from "@/lib/study-sessions/summary";
import { lastNDays } from "@/lib/habits/streak";
import { UpcomingTasksWidget, type UpcomingTaskData } from "./upcoming-tasks-widget";
import { StudyHabitsWidget } from "./study-habits-widget";

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
  ]);

  const studyToday = formatDuration(minutesOnDay(studySessions, now));
  const studyThisWeek = formatDuration(minutesBetween(studySessions, lastNDays(7, now)[0], now));

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
      <div className="space-y-8">
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-sm text-slate-400">{today}</p>
          <h1 className="mt-2 text-xl font-semibold text-slate-900">
            Let&apos;s set up your academics
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-sm text-slate-500">
            Create your first academic year to start tracking semesters, courses, and your GPA.
          </p>
          <Link
            href="/dashboard/academic-years"
            className="mt-6 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700"
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
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm text-slate-400">{today}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          {currentSemester ? `${currentSemester.name} · ${currentYear.label}` : currentYear.label}
        </h1>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="CGPA" value={cgpa.gpa.toFixed(2)} />
        <StatCard label="Semester GPA" value={semesterGpa.gpa.toFixed(2)} />
        <StatCard label="Credit units completed" value={String(cgpa.completedCreditUnits)} />
        <StatCard label="Credit units remaining" value={String(cgpa.remainingCreditUnits)} />
      </div>

      <UpcomingTasksWidget tasks={upcomingTasks} />

      <StudyHabitsWidget
        studyToday={studyToday}
        studyThisWeek={studyThisWeek}
        habitsCompletedToday={habitsCompletedToday}
        totalHabits={totalHabits}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-slate-900">Current courses</h2>
          {currentSemester && (
            <Link
              href={`/dashboard/semesters/${currentSemester._id.toString()}`}
              className="text-sm font-medium text-indigo-600 hover:underline"
            >
              Manage courses
            </Link>
          )}
        </div>
        {!currentSemester ? (
          <p className="text-sm text-slate-500">
            You haven&apos;t added a semester yet.{" "}
            <Link
              href={`/dashboard/academic-years/${currentYear._id.toString()}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              Add one
            </Link>{" "}
            to start tracking courses.
          </p>
        ) : currentSemesterCourses.length === 0 ? (
          <p className="text-sm text-slate-500">
            No courses yet for this semester.{" "}
            <Link
              href={`/dashboard/semesters/${currentSemester._id.toString()}`}
              className="font-medium text-indigo-600 hover:underline"
            >
              Add your first course
            </Link>
            .
          </p>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-slate-400">
                <th className="pb-2 font-medium">Code</th>
                <th className="pb-2 font-medium">Title</th>
                <th className="pb-2 font-medium">Units</th>
                <th className="pb-2 font-medium">Grade</th>
              </tr>
            </thead>
            <tbody>
              {currentSemesterCourses.map((course) => (
                <tr key={course._id.toString()} className="border-b border-slate-50 last:border-0">
                  <td className="py-2 font-medium text-slate-900">{course.code}</td>
                  <td className="py-2 text-slate-600">{course.title}</td>
                  <td className="py-2 text-slate-600">{course.creditUnits}</td>
                  <td className="py-2 text-slate-600">{course.grade ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
