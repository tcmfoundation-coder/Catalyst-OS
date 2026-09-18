import "server-only";
import { askStructured } from "@/lib/ai/orchestrator";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import { TUTOR_ROLE_INSTRUCTIONS } from "./instructions";
import { TutorModelOutputSchema, TutorRequestSchema, type TutorResult } from "./types";

/**
 * The AI Tutor's own service layer — tutor-specific behavior only. No
 * retrieval, no prompt construction, no LLM calls happen here: all of
 * that is AIOrchestrator's job (via askStructured, which itself reuses
 * the exact same RetrievalService/AcademicContextProvider/ContextAssembler/
 * PromptBuilder pipeline as ask()). This file's job is: validate the
 * tutor's own request shape, supply the tutor's teaching-style
 * instructions, and shape the result — nothing infrastructural.
 */

const TUTOR_SCHEMA_NAME = "tutor_response";

/**
 * Whatever actually failed downstream (retrieval, the Anthropic API, a
 * schema mismatch) is already captured server-side via AIOrchestrator's
 * own telemetry (logAskError) — never worth exposing to a student, since
 * an LLMProviderError's message can contain raw provider/API details
 * (status codes, response bodies). This is the one message a failed
 * generation ever surfaces, regardless of which stage failed.
 */
const GENERATION_FAILURE_MESSAGE = "Sorry, something went wrong generating a response. Please try again.";

export interface TutorDependencies {
  /** Injectable for tests — mocks only the external LLM boundary. */
  llmProvider?: LLMProvider;
}

export async function askTutor(userId: string, rawRequest: unknown, deps: TutorDependencies = {}): Promise<TutorResult> {
  const parsed = TutorRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      retrievalStatus: "no_relevant_sources",
      sources: [],
    };
  }

  const structured = await askStructured(
    userId,
    {
      question: parsed.data.question,
      materialId: parsed.data.materialId,
      courseId: parsed.data.courseId,
      conversationContext: parsed.data.conversationContext,
    },
    TutorModelOutputSchema,
    TUTOR_SCHEMA_NAME,
    { llmProvider: deps.llmProvider, roleInstructions: TUTOR_ROLE_INSTRUCTIONS },
  );

  if (!structured.ok) {
    return {
      ok: false,
      error: GENERATION_FAILURE_MESSAGE,
      retrievalStatus: structured.retrievalStatus,
      sources: structured.sources,
    };
  }

  return {
    ok: true,
    answer: structured.data.answer,
    followUpQuestion: structured.data.followUpQuestion,
    // Always from ContextAssembler's own output via askStructured, never
    // from the model's structured payload (TutorModelOutputSchema doesn't
    // even have a sources/retrievalStatus field) — the model structurally
    // cannot manufacture a citation.
    retrievalStatus: structured.retrievalStatus,
    sources: structured.sources,
    model: structured.model,
  };
}
