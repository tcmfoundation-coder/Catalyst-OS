import "server-only";
import { Types } from "mongoose";
import { z } from "zod";
import { generateStructuredResource } from "@/lib/ai/resource-generation";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import type { AIContextSource } from "@/lib/ai/types";
import { courseBelongsToUser } from "@/lib/actions/course-ownership";
import { connectToDatabase } from "@/lib/db";
import { StudyMaterial } from "@/models/StudyMaterial";
import { StudyResource, type IStudyResourceSource } from "@/models/StudyResource";
import { NOTES_GENERATION_REQUEST, NOTES_ROLE_INSTRUCTIONS } from "./notes-instructions";
import { StudyNotesModelOutputSchema, type NoteSection } from "./notes-schema";

/**
 * Owns exactly what the task calls out as the resource service's job:
 * material validation, the generation request, source attachment, and
 * persistence. Retrieval, context assembly, prompt construction, LLM
 * invocation, and structured validation all stay inside
 * generateStructuredResource() (the AI layer) — this file never touches
 * any of that directly, and never persists anything the AI layer didn't
 * already validate.
 */

const STUDY_NOTES_SCHEMA_NAME = "study_notes";
const GENERATION_FAILURE_MESSAGE = "Sorry, something went wrong generating study notes. Please try again.";

export const GenerateStudyNotesInputSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  courseId: z.string().optional(),
});
export type GenerateStudyNotesInput = z.infer<typeof GenerateStudyNotesInputSchema>;

export interface StudyNotesContent {
  title: string;
  overview: string;
  sections: NoteSection[];
}

export type GenerateStudyNotesResult =
  | { ok: true; resourceId: string; content: StudyNotesContent; sources: IStudyResourceSource[] }
  | { ok: false; error: string };

export interface StudyNotesServiceDependencies {
  /** Injectable for tests — see the "mock only the external LLM boundary" testing guidance this follows. */
  llmProvider?: LLMProvider;
}

/** Drops the chunk's full text — same shape/reasoning as TutorSourceView. */
function toResourceSources(sources: AIContextSource[]): IStudyResourceSource[] {
  return sources.map(({ chunkId, materialId, courseId, score, page, slide, heading }) => ({
    chunkId,
    materialId,
    courseId,
    score,
    page,
    slide,
    heading,
  }));
}

export async function generateStudyNotes(
  userId: string,
  rawInput: unknown,
  deps: StudyNotesServiceDependencies = {},
): Promise<GenerateStudyNotesResult> {
  const parsed = GenerateStudyNotesInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request" };
  }
  const { materialId, courseId } = parsed.data;

  if (!Types.ObjectId.isValid(materialId)) {
    return { ok: false, error: "Material not found" };
  }

  await connectToDatabase();

  const material = await StudyMaterial.findOne({ _id: materialId, userId });
  if (!material) {
    return { ok: false, error: "Material not found" };
  }
  if (material.status !== "ready") {
    return { ok: false, error: "This material isn't ready yet — wait for processing to finish before generating notes." };
  }

  if (courseId) {
    if (!Types.ObjectId.isValid(courseId) || !(await courseBelongsToUser(courseId, userId))) {
      return { ok: false, error: "Course not found" };
    }
  }

  const generated = await generateStructuredResource(
    userId,
    { materialId, courseId, instruction: NOTES_GENERATION_REQUEST },
    StudyNotesModelOutputSchema,
    STUDY_NOTES_SCHEMA_NAME,
    { llmProvider: deps.llmProvider, roleInstructions: NOTES_ROLE_INSTRUCTIONS },
  );

  if (!generated.ok) {
    // The "no usable content" refusal is a safe, application-authored
    // message — fine to show as-is. Anything else (a thrown provider
    // error, a schema-validation failure) must never reach the browser
    // verbatim; generateStructuredResource already logged the real error
    // server-side.
    const error = generated.retrievalStatus === "no_relevant_sources" ? generated.error : GENERATION_FAILURE_MESSAGE;
    return { ok: false, error };
  }

  const sources = toResourceSources(generated.sources);
  const content: StudyNotesContent = {
    title: generated.data.title,
    overview: generated.data.overview,
    sections: generated.data.sections,
  };

  const resource = await StudyResource.create({
    userId,
    type: "notes",
    title: content.title,
    materialId,
    courseId: courseId ?? material.courseId ?? null,
    // StudyResource.content is Mixed by design (see that model's comment)
    // — StudyNotesContent's own interface is the real shape guarantee here.
    content: content as unknown as Record<string, unknown>,
    sources,
  });

  return { ok: true, resourceId: resource._id.toString(), content, sources };
}
