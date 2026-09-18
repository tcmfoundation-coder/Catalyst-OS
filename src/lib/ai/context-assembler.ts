import type { RetrievalHit } from "@/lib/retrieval/types";
import { RETRIEVAL_POLICY } from "./constants";
import { AIContextSchema, type AIContext, type AcademicContext, type ConversationTurn } from "./types";

/**
 * Turns retrieved knowledge (+ optional academic/conversation context)
 * into the structured AIContext PromptBuilder renders. This is where
 * "don't dump everything into the prompt" is actually enforced — pure
 * function, no I/O, so every rule here (ordering, thresholding, budget)
 * is directly unit-testable without a database or a model.
 *
 * The retrieval pipeline described in the task spec (embed -> retrieve ->
 * threshold -> limit context -> preserve metadata -> build context) spans
 * two layers on purpose: RetrievalService already embeds, retrieves, and
 * applies a similarity floor (see its own DEFAULT_MIN_SCORE), so this
 * function's job is strictly the last three steps. It re-applies
 * `minimumSimilarity` defensively anyway, so it behaves correctly even if
 * a caller hands it hits from a different threshold than the shared
 * policy — that's what makes "similarity threshold" independently
 * testable at this layer without needing a live index.
 */

export interface ContextAssemblerInput {
  question: string;
  hits: RetrievalHit[];
  academicContext?: AcademicContext | null;
  conversationContext?: ConversationTurn[];
  minimumSimilarity?: number;
  maxContextChunks?: number;
  maxContextCharacters?: number;
}

export function build(input: ContextAssemblerInput): AIContext {
  const minimumSimilarity = input.minimumSimilarity ?? RETRIEVAL_POLICY.minimumSimilarity;
  const maxChunks = input.maxContextChunks ?? RETRIEVAL_POLICY.maxContextChunks;
  const maxChars = input.maxContextCharacters ?? RETRIEVAL_POLICY.maxContextCharacters;

  // Duplicate chunk handling: the same chunk could appear twice if a
  // caller merges hits from more than one retrieval call (e.g. a
  // course-scoped search plus a general one). Keep the highest score seen
  // for it rather than counting it twice against the chunk/character budget.
  const byChunkId = new Map<string, RetrievalHit>();
  for (const hit of input.hits) {
    if (hit.score < minimumSimilarity) continue;
    const existing = byChunkId.get(hit.chunk.id);
    if (!existing || hit.score > existing.score) {
      byChunkId.set(hit.chunk.id, hit);
    }
  }

  const orderedHits = [...byChunkId.values()].sort((a, b) => b.score - a.score);

  const sources: AIContext["sources"] = [];
  let totalChars = 0;
  for (const hit of orderedHits) {
    if (sources.length >= maxChunks) break;
    // Always include at least one source even if it alone exceeds the
    // character budget — an empty context is worse than one slightly
    // over budget — but never add a second chunk past the limit.
    if (sources.length > 0 && totalChars + hit.chunk.text.length > maxChars) break;

    sources.push({
      chunkId: hit.chunk.id,
      materialId: hit.chunk.materialId,
      courseId: hit.chunk.courseId,
      text: hit.chunk.text,
      score: hit.score,
      page: hit.source.page,
      slide: hit.source.slide,
      heading: hit.source.heading,
    });
    totalChars += hit.chunk.text.length;
  }

  return AIContextSchema.parse({
    question: input.question,
    retrievalStatus: sources.length > 0 ? "ok" : "no_relevant_sources",
    sources,
    academicContext: input.academicContext ?? null,
    conversationContext: input.conversationContext ?? [],
  });
}
