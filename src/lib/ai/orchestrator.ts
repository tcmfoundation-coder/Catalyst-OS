import "server-only";
import { z, type ZodType } from "zod";
import { search } from "@/lib/retrieval/service";
import { getAcademicContext } from "./academic-context";
import { getLLMProvider } from "./anthropic-provider";
import { build } from "./context-assembler";
import { RETRIEVAL_POLICY } from "./constants";
import { type LLMProvider, type LLMUsage } from "./llm-provider";
import { buildPrompt } from "./prompt-builder";
import { generateStructuredOutput } from "./structured-output";
import { logAskError, logAskEvent } from "./telemetry";
import { ConversationTurnSchema, type AIContext, type AIContextSource, type RetrievalStatus } from "./types";

/**
 * The application-level entry point for "ask a question, get a grounded
 * answer." A future chat UI, quiz generator, tutor, or study planner
 * calls this — and only this — without knowing that RAG, HNSW, or
 * Anthropic exist underneath. Coordinates RetrievalService (finds
 * knowledge), AcademicContextProvider (finds relevant structured
 * context), ContextAssembler (decides what the model actually sees), and
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
 *
 * ask() (free-text) and askStructured() (schema-validated JSON, e.g. for
 * the AI Tutor) share one internal `prepare()` step — retrieval, academic
 * context, context assembly, and prompt construction are identical either
 * way; only the final LLM call differs.
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

export type AskFailure = {
  ok: false;
  error: string;
  retrievalStatus: RetrievalStatus;
  sources: AIContextSource[];
};

export type AskResult =
  | {
      ok: true;
      answer: string;
      retrievalStatus: RetrievalStatus;
      sources: AIContextSource[];
      model: string;
      usage: LLMUsage;
    }
  | AskFailure;

export type StructuredAskResult<T> =
  | {
      ok: true;
      data: T;
      retrievalStatus: RetrievalStatus;
      sources: AIContextSource[];
      model: string;
      usage: LLMUsage;
    }
  | AskFailure;

export interface AskDependencies {
  /** Injectable for tests — see the "mock only the external LLM boundary" testing guidance this follows. */
  llmProvider?: LLMProvider;
  /**
   * Additional fixed, developer-authored instructions layered onto the
   * base prompt (see prompt-builder.ts's BuildPromptOptions) for a
   * specific feature's behavior (e.g. the AI Tutor's teaching style).
   * Never derived from user/document/context data — the base trust
   * boundary always applies regardless of what a feature adds here.
   */
  roleInstructions?: string;
}

interface PreparedRequest {
  context: AIContext;
  systemInstructions: string;
  userInput: string;
  hitCount: number;
  retrievalMs: number;
  academicContextMs: number;
  contextAssemblyMs: number;
}

type PrepareOutcome = { ok: true; prepared: PreparedRequest } | { ok: false; result: AskFailure };

async function prepare(
  userId: string,
  rawRequest: unknown,
  deps: AskDependencies,
  totalStart: number,
): Promise<PrepareOutcome> {
  const parsed = AskRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return {
      ok: false,
      result: {
        ok: false,
        error: parsed.error.issues[0]?.message ?? "Invalid request",
        retrievalStatus: "no_relevant_sources",
        sources: [],
      },
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
    return { ok: false, result: { ok: false, error: "Retrieval failed", retrievalStatus: "no_relevant_sources", sources: [] } };
  }
  const retrievalMs = Date.now() - retrievalStart;

  const wantsAcademicContext =
    request.includeAcademicContext ||
    Boolean(request.courseId) ||
    request.includeUpcomingTasks ||
    request.includeRecentMemories;
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

  const { systemInstructions, userInput } = buildPrompt(context, { roleInstructions: deps.roleInstructions });

  return {
    ok: true,
    prepared: { context, systemInstructions, userInput, hitCount: hits.length, retrievalMs, academicContextMs, contextAssemblyMs },
  };
}

export async function ask(userId: string, rawRequest: unknown, deps: AskDependencies = {}): Promise<AskResult> {
  const totalStart = Date.now();
  const outcome = await prepare(userId, rawRequest, deps, totalStart);
  if (!outcome.ok) return outcome.result;
  const { context, systemInstructions, userInput, hitCount, retrievalMs, academicContextMs, contextAssemblyMs } =
    outcome.prepared;

  const provider = deps.llmProvider ?? getLLMProvider();
  const generationStart = Date.now();
  try {
    const result = await provider.generate({ systemInstructions, userInput });
    const generationMs = Date.now() - generationStart;

    logAskEvent({
      userId,
      retrievalStatus: context.retrievalStatus,
      candidateCount: hitCount,
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
      candidateCount: hitCount,
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
      validationFailure: error instanceof Error ? error.message : undefined,
    });
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Generation failed",
      retrievalStatus: context.retrievalStatus,
      sources: context.sources,
    };
  }
}

/**
 * Same pipeline as ask(), but the model's output is required to match
 * `schema` (validated by structured-output.ts) instead of free text —
 * what the AI Tutor and future structured features (quizzes, flashcards,
 * study plans) build on. `sources`/`retrievalStatus` in the result always
 * come from ContextAssembler's own output, never from the model's
 * structured payload — a caller can't accidentally trust model-invented
 * citation metadata just because it asked for structured output.
 */
export async function askStructured<T>(
  userId: string,
  rawRequest: unknown,
  schema: ZodType<T>,
  schemaName: string,
  deps: AskDependencies = {},
): Promise<StructuredAskResult<T>> {
  const totalStart = Date.now();
  const outcome = await prepare(userId, rawRequest, deps, totalStart);
  if (!outcome.ok) return outcome.result;
  const { context, systemInstructions, userInput, hitCount, retrievalMs, academicContextMs, contextAssemblyMs } =
    outcome.prepared;

  const provider = deps.llmProvider ?? getLLMProvider();
  const generationStart = Date.now();
  const structured = await generateStructuredOutput(provider, { systemInstructions, userInput }, schema, schemaName);
  const generationMs = Date.now() - generationStart;

  if (!structured.ok) {
    logAskError(userId, "generation", structured.error);
    logAskEvent({
      userId,
      retrievalStatus: context.retrievalStatus,
      candidateCount: hitCount,
      selectedSourceIds: context.sources.map((source) => source.chunkId),
      selectedScores: context.sources.map((source) => source.score),
      model: "unknown",
      durations: { retrievalMs, academicContextMs, contextAssemblyMs, generationMs, totalMs: Date.now() - totalStart },
      validationFailure: structured.error,
    });
    return { ok: false, error: structured.error, retrievalStatus: context.retrievalStatus, sources: context.sources };
  }

  logAskEvent({
    userId,
    retrievalStatus: context.retrievalStatus,
    candidateCount: hitCount,
    selectedSourceIds: context.sources.map((source) => source.chunkId),
    selectedScores: context.sources.map((source) => source.score),
    model: structured.model,
    durations: { retrievalMs, academicContextMs, contextAssemblyMs, generationMs, totalMs: Date.now() - totalStart },
  });

  return {
    ok: true,
    data: structured.data,
    retrievalStatus: context.retrievalStatus,
    sources: context.sources,
    model: structured.model,
    usage: structured.usage,
  };
}
