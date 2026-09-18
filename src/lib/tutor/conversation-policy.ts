/**
 * The single, clearly-defined location for conversation-history limits —
 * same principle as lib/ai/constants.ts's RETRIEVAL_POLICY, and
 * deliberately separate from it: conversation history and retrieved
 * study material compete for the same prompt, but are bounded
 * independently (see conversation-context.ts's docstring for why history
 * must never crowd out the RAG context budget).
 */
export const CONVERSATION_POLICY = {
  /** Recent turns to consider, most-recent-first before bounding — 3 user+assistant pairs is enough for short-term continuity without re-litigating the whole conversation on every question. */
  maxHistoryMessages: 6,
  /** A firm ceiling well under RETRIEVAL_POLICY.maxContextCharacters (6000), so history can never crowd out retrieved material in the prompt. */
  maxHistoryCharacters: 2000,
} as const;
