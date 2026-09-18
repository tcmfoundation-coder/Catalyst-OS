/**
 * Structured, console-based observability for the AI pipeline — same
 * convention as the rest of the app (see e.g. actions/study-materials.ts's
 * console.error usage), just structured enough to grep/parse. No new
 * logging infrastructure: this app is a modular monolith and a single
 * process's stdout is enough at this scale.
 *
 * Deliberately never includes: API keys/secrets, full chunk/document
 * text, full conversation content, or anything beyond what's needed to
 * debug a request (IDs, counts, durations, scores, model names).
 */

export interface AskTelemetry {
  userId: string;
  retrievalStatus: "ok" | "no_relevant_sources" | "error";
  candidateCount: number;
  selectedSourceIds: string[];
  selectedScores: number[];
  model: string;
  durations: {
    retrievalMs: number;
    academicContextMs: number;
    contextAssemblyMs: number;
    generationMs: number;
    totalMs: number;
  };
  validationFailure?: string;
}

export function logAskEvent(event: AskTelemetry): void {
  console.log("[ai.ask]", JSON.stringify(event));
}

export function logAskError(userId: string, stage: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[ai.ask.error]", JSON.stringify({ userId, stage, message }));
}
