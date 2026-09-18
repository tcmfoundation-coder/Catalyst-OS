"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { generateStudyNotesAction } from "@/lib/actions/study-resources";

/**
 * Deliberately not "regenerate in place" — each click creates a new,
 * separate StudyResource (see the service's generateStudyNotes) and
 * navigates to it. No background/automatic regeneration, and no attempt
 * to dedupe: a user clicking this repeatedly just accumulates a few
 * versions in their own list, which "Delete" already handles.
 */
export function GenerateAgainButton({ materialId, courseId }: { materialId: string; courseId: string | null }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setGenerating(true);
    setError(null);
    try {
      const result = await generateStudyNotesAction({ materialId, courseId: courseId ?? undefined });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.push(`/dashboard/study-notes/${result.resourceId}`);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={generating}
        className="text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-60"
      >
        {generating ? "Generating…" : "Generate again"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
