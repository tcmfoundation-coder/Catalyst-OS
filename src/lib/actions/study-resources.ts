"use server";

import { requireUserId } from "@/lib/dal";
import { StudyNotesModelOutputSchema, type NoteSection } from "@/lib/study-resources/notes-schema";
import { deleteStudyResource, getStudyResource, listStudyResources, type StudyResourceSummary } from "@/lib/study-resources/resources";
import { generateStudyNotes, type GenerateStudyNotesResult } from "@/lib/study-resources/service";
import type { IStudyResourceSource } from "@/models/StudyResource";

export type GenerateStudyNotesInput = { materialId: string; courseId?: string };

/**
 * The one server boundary the Study Notes UI calls to generate a resource.
 * The authenticated user is established here, from the session — never
 * from anything the client sends — and threaded into generateStudyNotes(),
 * which re-verifies material/course ownership itself regardless.
 */
export async function generateStudyNotesAction(input: GenerateStudyNotesInput): Promise<GenerateStudyNotesResult> {
  const userId = await requireUserId();
  return generateStudyNotes(userId, input);
}

export async function listStudyNotesAction(materialId?: string): Promise<StudyResourceSummary[]> {
  const userId = await requireUserId();
  return listStudyResources(userId, { materialId, type: "notes" });
}

export interface StudyNotesView {
  id: string;
  title: string;
  materialId: string;
  courseId: string | null;
  createdAt: string;
  updatedAt: string;
  overview: string;
  sections: NoteSection[];
  sources: IStudyResourceSource[];
}

/**
 * Returns null for "doesn't exist", "belongs to someone else" (see
 * findOwnedStudyResource), and "isn't a notes resource" alike — the UI
 * doesn't need to (and shouldn't) distinguish those. Re-validating the
 * stored `content` against StudyNotesModelOutputSchema here — rather than
 * trusting it blindly — means a corrupted or future-incompatible document
 * fails closed (renders as "not found") instead of crashing the page or
 * rendering unvalidated data.
 */
export async function getStudyNotesAction(resourceId: string): Promise<StudyNotesView | null> {
  const userId = await requireUserId();
  const detail = await getStudyResource(userId, resourceId);
  if (!detail || detail.type !== "notes") return null;

  const parsedContent = StudyNotesModelOutputSchema.safeParse(detail.content);
  if (!parsedContent.success) return null;

  return {
    id: detail.id,
    title: detail.title,
    materialId: detail.materialId,
    courseId: detail.courseId,
    createdAt: detail.createdAt,
    updatedAt: detail.updatedAt,
    overview: parsedContent.data.overview,
    sections: parsedContent.data.sections,
    sources: detail.sources,
  };
}

export async function deleteStudyNotesAction(resourceId: string): Promise<{ ok: boolean }> {
  const userId = await requireUserId();
  const ok = await deleteStudyResource(userId, resourceId);
  return { ok };
}
