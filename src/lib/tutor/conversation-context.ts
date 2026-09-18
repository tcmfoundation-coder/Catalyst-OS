import type { ConversationTurn } from "@/lib/ai/types";
import { CONVERSATION_POLICY } from "./conversation-policy";

/**
 * Bounds a conversation's prior messages into what's actually sent as
 * <conversation_context> — the current question is never part of this,
 * it's passed separately (see lib/tutor/service.ts). Pure function, no
 * I/O, so bounding rules are directly unit-testable without a database.
 *
 * This is a genuinely different kind of "relevance" than RAG retrieval:
 * RetrievalService picks chunks by semantic similarity to the question,
 * regardless of when they were written. Conversation history has no
 * similarity ranking at all — "relevant" here just means "recent enough
 * to matter for continuity." Sending the whole conversation forever would
 * both blow the prompt budget and dilute attention on the actual
 * question, so this keeps only the most recent turns, further trimmed to
 * a character ceiling — always keeping at least one message once any
 * exist, mirroring ContextAssembler's own "never return an empty context
 * just because the first candidate was over budget" rule.
 */
export interface ConversationMessageLike {
  role: "user" | "assistant";
  content: string;
}

export function boundConversationHistory(
  messages: ConversationMessageLike[],
  policy: { maxHistoryMessages: number; maxHistoryCharacters: number } = CONVERSATION_POLICY,
): ConversationTurn[] {
  const recent = messages.slice(-policy.maxHistoryMessages);

  // Walk from most-recent to oldest, keeping messages until the character
  // budget would be exceeded — this keeps the *newest* context, not the
  // oldest, when the two limits disagree.
  const bounded: ConversationTurn[] = [];
  let totalChars = 0;
  for (let i = recent.length - 1; i >= 0; i--) {
    const message = recent[i];
    if (bounded.length > 0 && totalChars + message.content.length > policy.maxHistoryCharacters) break;
    bounded.unshift({ role: message.role, content: message.content });
    totalChars += message.content.length;
  }
  return bounded;
}
