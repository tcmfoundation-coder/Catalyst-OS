/**
 * The single, clearly-defined location for AI orchestration defaults —
 * nothing in src/lib/ai should hardcode a topK/threshold/token-limit
 * number of its own. Changing behavior means changing it here.
 */

export const DEFAULT_LLM_MODEL = "claude-sonnet-5";
export const DEFAULT_MAX_OUTPUT_TOKENS = 1024;

/**
 * Retrieval and context-assembly policy. topK/minimumSimilarity are
 * passed straight through to RetrievalService.search()'s own
 * topK/minScore options (that file documents why 0.3 is a loose floor,
 * not a precision relevance cutoff — sentence embeddings from the same
 * domain but a different topic can still score ~0.6). maxContextChunks
 * and maxContextCharacters are enforced by ContextAssembler and don't
 * exist anywhere in the retrieval layer — they're purely about what fits
 * in a prompt, not what's relevant.
 */
export const RETRIEVAL_POLICY = {
  topK: 5,
  minimumSimilarity: 0.3,
  maxContextChunks: 5,
  maxContextCharacters: 6000,
} as const;
