import { notFound } from "next/navigation";
import Link from "next/link";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { getStudyNotesAction } from "@/lib/actions/study-resources";
import { StudyMaterial } from "@/models/StudyMaterial";
import { DeleteNotesButton } from "./delete-notes-button";
import { GenerateAgainButton } from "./generate-again-button";

function sourceLocation(source: { page: number | null; slide: number | null; heading: string | null }): string | null {
  const parts = [
    source.page !== null ? `Page ${source.page}` : null,
    source.slide !== null ? `Slide ${source.slide}` : null,
    source.heading ? `"${source.heading}"` : null,
  ].filter((part): part is string => part !== null);
  return parts.length > 0 ? parts.join(", ") : null;
}

export default async function StudyNotesDetailPage({ params }: PageProps<"/dashboard/study-notes/[id]">) {
  await requireUserId();
  const { id } = await params;
  await connectToDatabase();

  const notes = await getStudyNotesAction(id);
  if (!notes) {
    notFound();
  }

  const material = await StudyMaterial.findById(notes.materialId).select("originalFilename").lean();

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard/study-notes" className="text-sm text-indigo-600 hover:underline">
          ← Study Notes
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-xl font-semibold text-slate-900">{notes.title}</h1>
          <div className="flex items-center gap-4">
            <GenerateAgainButton materialId={notes.materialId} courseId={notes.courseId} />
            <DeleteNotesButton resourceId={notes.id} />
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-400">
          AI-generated study notes based on your selected material
          {material ? ` (${material.originalFilename})` : ""} — generated{" "}
          {new Date(notes.createdAt).toLocaleString()}.
        </p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6">
        <p className="text-sm text-slate-700">{notes.overview}</p>
      </section>

      <div className="space-y-4">
        {notes.sections.map((section, index) => (
          <section key={index} className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-base font-semibold text-slate-900">{section.heading}</h2>
            <p className="mt-2 text-sm text-slate-700">{section.summary}</p>

            {section.keyPoints.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Key Points</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {section.keyPoints.map((point, i) => (
                    <li key={i}>{point}</li>
                  ))}
                </ul>
              </div>
            )}

            {section.definitions.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Definitions</h3>
                <dl className="mt-1 space-y-2 text-sm">
                  {section.definitions.map((definition, i) => (
                    <div key={i}>
                      <dt className="font-medium text-slate-800">{definition.term}</dt>
                      <dd className="text-slate-600">{definition.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}

            {section.examples.length > 0 && (
              <div className="mt-4">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Examples</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                  {section.examples.map((example, i) => (
                    <li key={i}>{example}</li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        ))}
      </div>

      {notes.sources.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Sources</h2>
          <ul className="space-y-2">
            {notes.sources.map((source, i) => {
              const location = sourceLocation(source);
              return (
                <li key={i} className="text-sm text-slate-600">
                  <span className="font-medium text-slate-800">{material?.originalFilename ?? "Material"}</span>
                  {location && <span className="text-slate-400"> — {location}</span>}
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
