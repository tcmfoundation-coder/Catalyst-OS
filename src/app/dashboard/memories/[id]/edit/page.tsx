import { notFound } from "next/navigation";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { LearningMemory } from "@/models/LearningMemory";
import { Course } from "@/models/Course";
import { updateLearningMemory } from "@/lib/actions/learning-memories";
import { MemoryForm } from "../../memory-form";

export default async function EditMemoryPage({
  params,
}: PageProps<"/dashboard/memories/[id]/edit">) {
  const userId = await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const [memory, courses] = await Promise.all([
    LearningMemory.findOne({ _id: id, userId }).lean(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
  ]);

  if (!memory) {
    notFound();
  }

  return (
    <div className="max-w-xl space-y-6">
      <h1 className="text-xl font-semibold text-slate-900">Edit memory</h1>
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <MemoryForm
          action={updateLearningMemory.bind(null, id)}
          courses={courses.map((course) => ({
            id: course._id.toString(),
            label: `${course.code} · ${course.title}`,
          }))}
          submitLabel="Save changes"
          cancelHref="/dashboard/memories"
          defaultValues={{
            content: memory.content,
            category: memory.category,
            courseId: memory.courseId ? memory.courseId.toString() : "",
          }}
        />
      </div>
    </div>
  );
}
