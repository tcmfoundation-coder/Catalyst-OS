import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { calculateCGPA, calculateSemesterGPA } from "@/lib/academic/gpa";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { lastNDays } from "@/lib/habits/streak";
import { formatDuration, minutesBetween, minutesOnDay } from "@/lib/study-sessions/summary";
import { compareTasks } from "@/lib/tasks/sort";
import type { ITask } from "@/models/Task";
import { AcademicYear } from "@/models/AcademicYear";
import { Course } from "@/models/Course";
import { Habit } from "@/models/Habit";
import { HabitLog } from "@/models/HabitLog";
import { Semester } from "@/models/Semester";
import { StudySession } from "@/models/StudySession";
import { Task } from "@/models/Task";

const NO_STORE = { "Cache-Control": "no-store" };
const UPCOMING_TASKS_LIMIT = 5;

interface CourseLean {
  _id: Types.ObjectId;
  semesterId: Types.ObjectId;
  code: string;
  title: string;
  creditUnits: number;
  grade: string | null;
}

interface TaskLean {
  _id: Types.ObjectId;
  title: string;
  status: ITask["status"];
  priority: ITask["priority"];
  dueDate: Date | null;
  courseId: { code: string; title: string } | null;
}

export async function GET(request: Request) {
  const principal = await authenticateMobileRequest(request);
  if (!principal) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers: NO_STORE });
  }

  const userId = principal.userId;
  const now = new Date();
  const todayUtcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

  const [currentYear, currentSemester, courses, tasks, studySessions, totalHabits, completedHabits] =
    await Promise.all([
      AcademicYear.findOne({ userId, isCurrent: true }).lean(),
      Semester.findOne({ userId, isCurrent: true }).lean(),
      Course.find({ userId }).lean<CourseLean[]>(),
      Task.find({ userId, status: { $ne: "completed" } })
        .populate("courseId", "code title")
        .lean<TaskLean[]>(),
      StudySession.find({ userId }).select("date durationMinutes").lean(),
      Habit.countDocuments({ userId }),
      HabitLog.countDocuments({ userId, date: todayUtcMidnight }),
    ]);

  const semesterCourses = currentSemester
    ? courses.filter((course) => course.semesterId.toString() === currentSemester._id.toString())
    : [];
  const cgpa = calculateCGPA(courses);
  const semesterGpa = calculateSemesterGPA(semesterCourses);
  const upcomingTasks = [...tasks]
    .sort((a, b) =>
      compareTasks("dueDate")(
        {
          dueDate: a.dueDate,
          priority: a.priority,
          courseTitle: a.courseId?.title ?? null,
        },
        {
          dueDate: b.dueDate,
          priority: b.priority,
          courseTitle: b.courseId?.title ?? null,
        },
      ),
    )
    .slice(0, UPCOMING_TASKS_LIMIT)
    .map((task) => ({
      id: task._id.toString(),
      title: task.title,
      status: task.status,
      dueDate: task.dueDate?.toISOString() ?? null,
      courseCode: task.courseId?.code ?? null,
    }));

  return NextResponse.json(
    {
      academic: currentYear
        ? {
            year: currentYear.label,
            semester: currentSemester?.name ?? null,
            cgpa: cgpa.gpa,
            semesterGpa: semesterGpa.gpa,
            completedCreditUnits: cgpa.completedCreditUnits,
            remainingCreditUnits: cgpa.remainingCreditUnits,
            courses: semesterCourses.map((course) => ({
              id: course._id.toString(),
              code: course.code,
              title: course.title,
              creditUnits: course.creditUnits,
              grade: course.grade,
            })),
          }
        : null,
      tasks: upcomingTasks,
      study: {
        today: formatDuration(minutesOnDay(studySessions, now)),
        thisWeek: formatDuration(minutesBetween(studySessions, lastNDays(7, now)[0], now)),
      },
      habits: { completedToday: completedHabits, total: totalHabits },
    },
    { headers: NO_STORE },
  );
}
