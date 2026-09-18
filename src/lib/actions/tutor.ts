"use server";

import { requireUserId } from "@/lib/dal";
import { askTutor } from "@/lib/tutor/service";
import type { TutorResult } from "@/lib/tutor/types";

export type AskTutorInput = {
  question: string;
  materialId?: string;
  courseId?: string;
};

/**
 * The one server boundary the Tutor UI calls. The authenticated user is
 * established here, from the session — never from anything the client
 * sends — and threaded into askTutor(), which threads it through
 * RetrievalService/AcademicContextProvider so a request scoped to
 * materialId/courseId can only ever touch this user's own data.
 */
export async function askTutorAction(input: AskTutorInput): Promise<TutorResult> {
  const userId = await requireUserId();
  return askTutor(userId, input);
}
