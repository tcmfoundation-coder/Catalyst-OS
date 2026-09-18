"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateStudyNotesAction } from "@/lib/actions/study-resources";

interface Option {
  id: string;
  label: string;
}

const inputClassName =
  "mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500";

export function GenerateNotesForm({ materials, courses }: { materials: Option[]; courses: Option[] }) {
  const router = useRouter();
  const [materialId, setMaterialId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (!materialId || generating) return;
    setGenerating(true);
    setError(null);
    try {
      const result = await generateStudyNotesAction({ materialId, courseId: courseId || undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/study-notes/${result.resourceId}`);
    } catch {
      setError("Sorry, something went wrong generating study notes. Please try again.");
      setGenerating(false);
    }
  }

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-6">
      <div>
        <h2 className="text-sm font-semibold text-slate-900">Generate Study Notes</h2>
        <p className="mt-1 text-sm text-slate-500">
          AI-generated study notes based on your selected material — not a guaranteed complete
          summary of the entire document.
        </p>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-slate-500">
          Upload a study material and wait for it to finish processing before generating notes.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="notesMaterialId" className="block text-sm font-medium text-slate-700">
                Material
              </label>
              <select
                id="notesMaterialId"
                value={materialId}
                onChange={(event) => setMaterialId(event.target.value)}
                disabled={generating}
                required
                className={inputClassName}
              >
                <option value="">Select a material…</option>
                {materials.map((material) => (
                  <option key={material.id} value={material.id}>
                    {material.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="notesCourseId" className="block text-sm font-medium text-slate-700">
                Course <span className="font-normal text-slate-400">(optional)</span>
              </label>
              <select
                id="notesCourseId"
                value={courseId}
                onChange={(event) => setCourseId(event.target.value)}
                disabled={generating}
                className={inputClassName}
              >
                <option value="">No course</option>
                {courses.map((course) => (
                  <option key={course.id} value={course.id}>
                    {course.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerate}
            disabled={!materialId || generating}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-700 disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate Study Notes"}
          </button>

          {generating && (
            <p className="text-sm text-slate-500">
              Reading your material and generating notes — this can take a moment…
            </p>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
