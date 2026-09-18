import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { StudySession } from "@/models/StudySession";
import { Course } from "@/models/Course";
import { updateStudySession } from "@/lib/actions/study-sessions";
import { SessionForm } from "../../session-form";

function toDateInputValue(date: Date): string {
  return new Date(date).toISOString().slice(0, 10);
}

export default async function EditStudySessionPage({
  params,
}: PageProps<"/dashboard/study-sessions/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const [session, courses] = await Promise.all([
    StudySession.findOne({ _id: id, userId }).lean(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
  ]);

  if (!session) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Edit study session</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <SessionForm
          action={updateStudySession.bind(null, id)}
          courses={courses.map((course) => ({
            id: course._id.toString(),
            label: `${course.code} · ${course.title}`,
          }))}
          submitLabel="Save changes"
          cancelHref="/dashboard/study-sessions"
          defaultValues={{
            date: toDateInputValue(session.date),
            durationMinutes: String(session.durationMinutes),
            courseId: session.courseId ? session.courseId.toString() : "",
            notes: session.notes ?? "",
          }}
        />
      </div>
    </div>
  );
}
