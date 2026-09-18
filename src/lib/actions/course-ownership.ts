import { Course } from "@/models/Course";

/**
 * Many records (tasks, study sessions, ...) can optionally link to one of
 * the user's courses. An empty courseId means "no course", which is always
 * allowed; a non-empty one must belong to the same user.
 */
export async function courseBelongsToUser(courseId: string, userId: string): Promise<boolean> {
  if (!courseId) return true;
  const course = await Course.findOne({ _id: courseId, userId }).select("_id");
  return Boolean(course);
}
