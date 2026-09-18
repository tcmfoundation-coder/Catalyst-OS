import Link from "next/link";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { listStudyResources } from "@/lib/study-resources/resources";
import { Course } from "@/models/Course";
import { StudyMaterial } from "@/models/StudyMaterial";
import { GenerateNotesForm } from "./generate-notes-form";

export default async function StudyNotesPage() {
  const userId = await requireUserId();
  await connectToDatabase();

  // Only "ready" materials have extracted chunks to generate notes from.
  const [materials, courses, resources] = await Promise.all([
    StudyMaterial.find({ userId, status: "ready" })
      .select("originalFilename")
      .sort({ createdAt: -1 })
      .lean(),
    Course.find({ userId }).select("code title").sort({ code: 1 }).lean(),
    listStudyResources(userId, { type: "notes" }),
  ]);

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Study Notes</h1>
        <p className="mt-1 text-sm text-slate-500">
          AI-generated study notes based on your uploaded study materials.
        </p>
      </div>

      <GenerateNotesForm
        materials={materials.map((material) => ({ id: material._id.toString(), label: material.originalFilename }))}
        courses={courses.map((course) => ({ id: course._id.toString(), label: `${course.code} · ${course.title}` }))}
      />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-slate-900">Previously generated</h2>
        {resources.length === 0 ? (
          <p className="text-sm text-slate-500">No study notes generated yet.</p>
        ) : (
          <ul className="space-y-2">
            {resources.map((resource) => (
              <li key={resource.id}>
                <Link
                  href={`/dashboard/study-notes/${resource.id}`}
                  className="block rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-indigo-300"
                >
                  <p className="font-medium text-slate-900">{resource.title}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {new Date(resource.updatedAt).toLocaleString()}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
