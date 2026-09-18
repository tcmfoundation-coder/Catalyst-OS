import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Course } from "@/models/Course";
import { createStudySession } from "@/lib/actions/study-sessions";
import { SessionForm } from "../session-form";

export default async function NewStudySessionPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const courses = await Course.find({ userId }).select("code title").sort({ code: 1 }).lean();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Log a study session</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SessionForm
          action={createStudySession}
          courses={courses.map((course) => ({
            id: course._id.toString(),
            label: `${course.code} · ${course.title}`,
          }))}
          submitLabel="Log session"
          cancelHref="/dashboard/study-sessions"
        />
      </div>
    </div>
  );
}
