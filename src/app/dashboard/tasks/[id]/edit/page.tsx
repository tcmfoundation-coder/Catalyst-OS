import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Task } from "@/models/Task";
import { Course } from "@/models/Course";
import { updateTask } from "@/lib/actions/tasks";
import { TaskForm } from "../../task-form";

function toDateInputValue(date: Date): string {
  // dueDate is stored as a UTC calendar date (see lib/tasks/overdue.ts), so
  // format from the UTC fields to avoid shifting a day in other timezones.
  return new Date(date).toISOString().slice(0, 10);
}

export default async function EditTaskPage({
  params,
}: PageProps<"/dashboard/tasks/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const [task, courses] = await Promise.all([
    Task.findOne({ _id: id, userId }).lean(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
  ]);

  if (!task) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Edit task</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <TaskForm
          action={updateTask.bind(null, id)}
          courses={courses.map((course) => ({
            id: course._id.toString(),
            label: `${course.code} · ${course.title}`,
          }))}
          submitLabel="Save changes"
          cancelHref="/dashboard/tasks"
          showStatus
          defaultValues={{
            title: task.title,
            description: task.description ?? "",
            type: task.type,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate ? toDateInputValue(task.dueDate) : "",
            courseId: task.courseId ? task.courseId.toString() : "",
          }}
        />
      </div>
    </div>
  );
}
