import "server-only";
import { z } from "zod";
import { search } from "@/lib/retrieval/service";
import { getAcademicContext } from "./academic-context";
import { getLLMProvider } from "./anthropic-provider";
import { build } from "./context-assembler";
import { RETRIEVAL_POLICY } from "./constants";
import { LLMProviderError, type LLMProvider } from "./llm-provider";
import { buildPrompt } from "./prompt-builder";
import { logAskError, logAskEvent } from "./telemetry";
import { ConversationTurnSchema, type AIContextSource, type RetrievalStatus } from "./types";

/**
 * The application-level entry point for "ask a question, get a grounded
 * answer." A future chat UI, quiz generator, or study planner calls this
 * — and only this — without knowing that RAG, HNSW, or Anthropic exist
 * underneath. Coordinates RetrievalService (finds knowledge),
 * AcademicContextProvider (finds relevant structured context),
 * ContextAssembler (decides what the model actually sees), and
 * LLMProvider (generates), keeping every one of those concerns in its
 * own file.
 *
 * Like RetrievalService.search(), this takes an already-authenticated
 * `userId` rather than establishing a session itself — the Next.js
 * request/session boundary belongs in a Server Action (see dal.ts's
 * requireUserId()), same as every other feature in this app. What this
 * function *does* own is threading that single userId through every
 * downstream call, so nothing here can accidentally cross into another
 * user's data — and RetrievalService's own ownership enforcement holds
 * regardless, as defense in depth.
 */

export const AskRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000, "Question is too long"),
  materialId: z.string().optional(),
  courseId: z.string().optional(),
  semesterId: z.string().optional(),
  includeAcademicContext: z.boolean().optional(),
  includeUpcomingTasks: z.boolean().optional(),
  includeRecentMemories: z.boolean().optional(),
  conversationContext: z.array(ConversationTurnSchema).optional(),
});
export type AskRequest = z.infer<typeof AskRequestSchema>;

export type AskResult =
  | {
      ok: true;
      answer: string;
      retrievalStatus: RetrievalStatus;
      sources: AIContextSource[];
      model: string;
      usage: { inputTokens: number; outputTokens: number };
    }
  | {
      ok: false;
      error: string;
      retrievalStatus: RetrievalStatus;
      sources: AIContextSource[];
    };

export interface AskDependencies {
  /** Injectable for tests — see the "mock only the external LLM boundary" testing guidance this follows. */
  llmProvider?: LLMProvider;
}

export async function ask(userId: string, rawRequest: unknown, deps: AskDependencies = {}): Promise<AskResult> {
  const totalStart = Date.now();
  const parsed = AskRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      retrievalStatus: "no_relevant_sources",
      sources: [],
    };
  }
  const request = parsed.data;

  const retrievalStart = Date.now();
  let hits: Awaited<ReturnType<typeof search>>;
  try {
    hits = await search(userId, request.question, {
      topK: RETRIEVAL_POLICY.topK,
      minScore: RETRIEVAL_POLICY.minimumSimilarity,
      filter: { materialId: request.materialId, courseId: request.courseId, semesterId: request.semesterId },
    });
  } catch (error) {
    logAskError(userId, "retrieval", error);
    logAskEvent({
      userId,
      retrievalStatus: "error",
      candidateCount: 0,
      selectedSourceIds: [],
      selectedScores: [],
      model: "unknown",
      durations: {
        retrievalMs: Date.now() - retrievalStart,
        academicContextMs: 0,
        contextAssemblyMs: 0,
        generationMs: 0,
        totalMs: Date.now() - totalStart,
      },
    });
    return { ok: false, error: "Retrieval failed", retrievalStatus: "no_relevant_sources", sources: [] };
  }
  const retrievalMs = Date.now() - retrievalStart;

  const wantsAcademicContext =
    request.includeAcademicContext || Boolean(request.courseId) || request.includeUpcomingTasks || request.includeRecentMemories;
  const academicStart = Date.now();
  let academicContext = null;
  if (wantsAcademicContext) {
    try {
      academicContext = await getAcademicContext(userId, {
        courseId: request.courseId,
        includeCurrentAcademicPeriod: request.includeAcademicContext,
        includeUpcomingTasks: request.includeUpcomingTasks,
        includeRecentMemories: request.includeRecentMemories,
      });
    } catch (error) {
      // Academic context is additive, not a hard dependency of answering
      // — a failure here degrades to "no academic context" instead of
      // failing the whole request.
      logAskError(userId, "academic-context", error);
    }
  }
  const academicContextMs = Date.now() - academicStart;

  const assemblyStart = Date.now();
  const context = build({
    question: request.question,
    hits,
    academicContext,
    conversationContext: request.conversationContext,
  });
  const contextAssemblyMs = Date.now() - assemblyStart;

  const provider = deps.llmProvider ?? getLLMProvider();
  const { systemInstructions, userInput } = buildPrompt(context);

  const generationStart = Date.now();
  try {
    const result = await provider.generate({ systemInstructions, userInput });
    const generationMs = Date.now() - generationStart;

    logAskEvent({
      userId,
      retrievalStatus: context.retrievalStatus,
      candidateCount: hits.length,
      selectedSourceIds: context.sources.map((source) => source.chunkId),
      selectedScores: context.sources.map((source) => source.score),
      model: result.model,
      durations: { retrievalMs, academicContextMs, contextAssemblyMs, generationMs, totalMs: Date.now() - totalStart },
    });

    return {
      ok: true,
      answer: result.text,
      retrievalStatus: context.retrievalStatus,
      sources: context.sources,
      model: result.model,
      usage: result.usage,
    };
  } catch (error) {
    logAskError(userId, "generation", error);
    logAskEvent({
      userId,
      // Retrieval itself succeeded (or legitimately found nothing) —
      // it's the generation step that failed, so the telemetry should
      // reflect what actually happened during retrieval, not overwrite
      // it with a generic "error".
      retrievalStatus: context.retrievalStatus,
      candidateCount: hits.length,
      selectedSourceIds: context.sources.map((source) => source.chunkId),
      selectedScores: context.sources.map((source) => source.score),
      model: "unknown",
      durations: {
        retrievalMs,
        academicContextMs,
        contextAssemblyMs,
        generationMs: Date.now() - generationStart,
        totalMs: Date.now() - totalStart,
      },
      validationFailure: error instanceof LLMProviderError ? error.message : undefined,
    });
    return {
      ok: false,
      error: error instanceof LLMProviderError ? error.message : "Generation failed",
      retrievalStatus: context.retrievalStatus,
      sources: context.sources,
    };
  }
}
