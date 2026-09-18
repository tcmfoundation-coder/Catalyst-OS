import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Course } from "@/models/Course";
import { createTask } from "@/lib/actions/tasks";
import { TaskForm } from "../task-form";

export default async function NewTaskPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  const courses = await Course.find({ userId }).select("code title").sort({ code: 1 }).lean();

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">New task</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <TaskForm
          action={createTask}
          courses={courses.map((course) => ({
            id: course._id.toString(),
            label: `${course.code} · ${course.title}`,
          }))}
          submitLabel="Add task"
          cancelHref="/dashboard/tasks"
        />
      </div>
    </div>
  );
}
