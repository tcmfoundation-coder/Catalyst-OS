/**
 * A conversation's title is derived deterministically from its first
 * question — no second AI call just to name it. Plain truncation and
 * whitespace/punctuation normalization, nothing cleverer: recognizing
 * phrasings like "difference between X and Y" would be fragile pattern-
 * matching for one shape of question among many, not a real title
 * generator.
 */
const MAX_TITLE_LENGTH = 60;

export function deriveConversationTitle(firstQuestion: string): string {
  const cleaned = firstQuestion.trim().replace(/\s+/g, " ").replace(/[?!.]+$/, "");
  if (cleaned.length === 0) return "New conversation";
  if (cleaned.length <= MAX_TITLE_LENGTH) return cleaned;
  return `${cleaned.slice(0, MAX_TITLE_LENGTH - 1).trimEnd()}…`;
}
