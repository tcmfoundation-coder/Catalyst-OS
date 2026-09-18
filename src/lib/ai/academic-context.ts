import "server-only";
import { connectToDatabase } from "@/lib/db";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { AcademicYear } from "@/models/AcademicYear";
import { Course } from "@/models/Course";
import { LearningMemory } from "@/models/LearningMemory";
import { Semester } from "@/models/Semester";
import { Task } from "@/models/Task";
import type { AcademicContext } from "./types";

/**
 * Deliberate, opt-in academic context — never "everything the user has."
 * Every field here is fetched only when explicitly requested, and every
 * query is scoped to `userId` at the database layer, never trusting a
 * client-supplied id on its own: a caller-supplied courseId is checked
 * with courseBelongsToUser (the same helper tasks/study-sessions/learning-
 * memories already use) before anything scoped to it is fetched. A
 * request with every flag left unset returns an empty context — this is
 * the "Question about MTH course material -> relevant course context"
 * shape from the task spec, not "every course/task/memory/grade -> LLM."
 */
export interface AcademicContextRequest {
  courseId?: string;
  includeCurrentAcademicPeriod?: boolean;
  includeUpcomingTasks?: boolean;
  includeRecentMemories?: boolean;
}

const MAX_UPCOMING_TASKS = 5;
const MAX_RECENT_MEMORIES = 5;

export async function getAcademicContext(userId: string, request: AcademicContextRequest): Promise<AcademicContext> {
  await connectToDatabase();

  const context: AcademicContext = {};

  let course: { id: string; code: string; title: string; grade: string | null } | null = null;
  if (request.courseId) {
    const owns = await courseBelongsToUser(request.courseId, userId);
    if (owns) {
      const doc = await Course.findOne({ _id: request.courseId, userId }).lean();
      if (doc) {
        course = { id: doc._id.toString(), code: doc.code, title: doc.title, grade: doc.grade };
      }
    }
    context.course = course;
  }

  if (request.includeCurrentAcademicPeriod) {
    const [year, semester] = await Promise.all([
      AcademicYear.findOne({ userId, isCurrent: true }).lean(),
      Semester.findOne({ userId, isCurrent: true }).lean(),
    ]);
    context.currentAcademicYear = year ? { id: year._id.toString(), label: year.label } : null;
    context.currentSemester = semester ? { id: semester._id.toString(), name: semester.name } : null;
  }

  if (request.includeUpcomingTasks) {
    const tasks = await Task.find({
      userId,
      status: { $ne: "completed" },
      dueDate: { $ne: null },
      ...(course ? { courseId: course.id } : {}),
    })
      .sort({ dueDate: 1 })
      .limit(MAX_UPCOMING_TASKS)
      .lean();
    context.upcomingTasks = tasks.map((task) => ({
      id: task._id.toString(),
      title: task.title,
      dueDate: task.dueDate ? task.dueDate.toISOString() : null,
      priority: task.priority,
    }));
  }

  if (request.includeRecentMemories) {
    const memories = await LearningMemory.find({
      userId,
      ...(course ? { courseId: course.id } : {}),
    })
      .sort({ createdAt: -1 })
      .limit(MAX_RECENT_MEMORIES)
      .lean();
    context.recentMemories = memories.map((memory) => ({
      id: memory._id.toString(),
      content: memory.content,
      category: memory.category,
    }));
  }

  return context;
}
