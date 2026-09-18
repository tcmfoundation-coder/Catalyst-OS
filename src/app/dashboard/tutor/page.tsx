import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { Course } from "@/models/Course";
import { StudyMaterial } from "@/models/StudyMaterial";
import { TutorChat } from "./tutor-chat";

export default async function TutorPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  // Only "ready" materials have embedded, searchable chunks — scoping to
  // one that isn't ready yet would just always come back with no sources.
  const [materials, courses] = await Promise.all([
    StudyMaterial.find({ userId, status: "ready" })
      .select("originalFilename")
      .sort({ createdAt: -1 })
      .lean(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
  ]);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">AI Tutor</h1>
        <p className="mt-1 text-sm text-slate-500">
          Ask a question and get an explanation grounded in your uploaded study material, with
          sources you can check.
        </p>
      </div>
      <TutorChat
        materials={materials.map((material) => ({
          id: material._id.toString(),
          label: material.originalFilename,
        }))}
        courses={courses.map((course) => ({
          id: course._id.toString(),
          label: `${course.code} · ${course.title}`,
        }))}
      />
    </div>
  );
}
