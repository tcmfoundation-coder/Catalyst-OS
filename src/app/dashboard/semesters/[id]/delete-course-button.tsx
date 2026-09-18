"use client";

import { deleteCourse } from "@/lib/actions/courses";

export function DeleteCourseButton({ courseId }: { courseId: string }) {
  return (
    <form action={deleteCourse.bind(null, courseId)}>
      <button type="submit" className="text-xs font-medium text-red-500 hover:text-red-700">
        Remove
      </button>
    </form>
  );
}
