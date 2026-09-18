import "server-only";
import type { ZodType } from "zod";
import { getMaterialCoverage } from "@/lib/retrieval/service";
import { getLLMProvider } from "./anthropic-provider";
import { build } from "./context-assembler";
import { RESOURCE_GENERATION_MAX_OUTPUT_TOKENS, RESOURCE_RETRIEVAL_POLICY } from "./constants";
import type { LLMProvider } from "./llm-provider";
import { buildPrompt } from "./prompt-builder";
import { ResourceGenerationRequestSchema, type ResourceGenerationResult } from "./resource-types";
import { generateStructuredOutput } from "./structured-output";
import { logAskError, logAskEvent } from "./telemetry";

/**
 * The AI-layer entry point for structured, material-grounded resource
 * generation (Study Notes today; a future quiz/flashcard generator calls
 * this too, with its own instruction/roleInstructions/schema) — the third
 * sibling next to ask()/askStructured() in orchestrator.ts, not folded
 * into either of them, because the two differ in a way that matters for
 * correctness, not just plumbing:
 *
 *   - ask()/askStructured() take a semantic question and retrieve the
 *     best-matching chunks for it (RetrievalService.search()). When
 *     nothing matches, Tutor still answers from general knowledge — a
 *     reasonable, clearly-labeled degradation for a question-answering
 *     feature.
 *   - A resource generator has no question to match against — it needs
 *     coverage of a specific material (RetrievalService.getMaterialCoverage()).
 *     And when there's nothing to cover, there is nothing to generate
 *     notes ABOUT, so this function refuses outright and never calls the
 *     LLM — an ungrounded "study notes" document would be actively
 *     misleading in a way an ungrounded Tutor answer (clearly labeled as
 *     general knowledge, sitting next to the user's own question) is not.
 *
 * Everything else — context assembly, the prompt's trust boundary,
 * structured-output validation — is the exact same machinery ask()/
 * askStructured() already use, reused as-is here.
 */

export interface ResourceGenerationDependencies {
  /** Injectable for tests — see the "mock only the external LLM boundary" testing guidance this follows. */
  llmProvider?: LLMProvider;
  /** Fixed, developer-authored instructions for this resource type (e.g. Study Notes' formatting/grounding rules) — never derived from material/user content. */
  roleInstructions?: string;
}

const NO_USABLE_CONTENT_ERROR = "No usable content was found in this material to generate from.";

export async function generateStructuredResource<T>(
  userId: string,
  rawRequest: unknown,
  schema: ZodType<T>,
  schemaName: string,
  deps: ResourceGenerationDependencies = {},
): Promise<ResourceGenerationResult<T>> {
  const totalStart = Date.now();

  const parsed = ResourceGenerationRequestSchema.safeParse(rawRequest);
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
  let hits;
  try {
    hits = await getMaterialCoverage(userId, request.materialId, {
      maxChunks: RESOURCE_RETRIEVAL_POLICY.maxChunks,
      maxCharacters: RESOURCE_RETRIEVAL_POLICY.maxCharacters,
    });
  } catch (error) {
    logAskError(userId, "resource-retrieval", error);
    return { ok: false, error: "Retrieval failed", retrievalStatus: "no_relevant_sources", sources: [] };
  }
  const retrievalMs = Date.now() - retrievalStart;

  const context = build({
    question: request.instruction,
    hits,
    // Coverage hits carry no similarity score to threshold against — see
    // getMaterialCoverage's comment — so the floor is disabled here; only
    // maxChunks/maxCharacters (already applied once by getMaterialCoverage)
    // matter, reapplied here defensively for the same reason ContextAssembler
    // reapplies RETRIEVAL_POLICY's own thresholds.
    minimumSimilarity: 0,
    maxContextChunks: RESOURCE_RETRIEVAL_POLICY.maxChunks,
    maxContextCharacters: RESOURCE_RETRIEVAL_POLICY.maxCharacters,
  });

  if (context.retrievalStatus === "no_relevant_sources") {
    logAskEvent({
      userId,
      retrievalStatus: "no_relevant_sources",
      candidateCount: hits.length,
      selectedSourceIds: [],
      selectedScores: [],
      model: "unknown",
      durations: { retrievalMs, academicContextMs: 0, contextAssemblyMs: 0, generationMs: 0, totalMs: Date.now() - totalStart },
    });
    return { ok: false, error: NO_USABLE_CONTENT_ERROR, retrievalStatus: "no_relevant_sources", sources: [] };
  }

  const { systemInstructions, userInput } = buildPrompt(context, { roleInstructions: deps.roleInstructions });

  const provider = deps.llmProvider ?? getLLMProvider();
  const generationStart = Date.now();
  const structured = await generateStructuredOutput(
    provider,
    { systemInstructions, userInput, maxOutputTokens: RESOURCE_GENERATION_MAX_OUTPUT_TOKENS },
    schema,
    schemaName,
  );
  const generationMs = Date.now() - generationStart;

  if (!structured.ok) {
    logAskError(userId, "resource-generation", structured.error);
    logAskEvent({
      userId,
      retrievalStatus: context.retrievalStatus,
      candidateCount: hits.length,
      selectedSourceIds: context.sources.map((source) => source.chunkId),
      selectedScores: context.sources.map((source) => source.score),
      model: "unknown",
      durations: { retrievalMs, academicContextMs: 0, contextAssemblyMs: 0, generationMs, totalMs: Date.now() - totalStart },
      validationFailure: structured.error,
    });
    return { ok: false, error: structured.error, retrievalStatus: context.retrievalStatus, sources: context.sources };
  }

  logAskEvent({
    userId,
    retrievalStatus: context.retrievalStatus,
    candidateCount: hits.length,
    selectedSourceIds: context.sources.map((source) => source.chunkId),
    selectedScores: context.sources.map((source) => source.score),
    model: structured.model,
    durations: { retrievalMs, academicContextMs: 0, contextAssemblyMs: 0, generationMs, totalMs: Date.now() - totalStart },
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
