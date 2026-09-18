import "server-only";
import { connectToDatabase } from "@/lib/db";
import { askStructured } from "@/lib/ai/orchestrator";
import type { LLMProvider } from "@/lib/ai/llm-provider";
import type { AIContextSource } from "@/lib/ai/types";
import { TutorConversation } from "@/models/TutorConversation";
import { TutorMessage } from "@/models/TutorMessage";
import { boundConversationHistory } from "./conversation-context";
import { CONVERSATION_POLICY } from "./conversation-policy";
import { deriveConversationTitle } from "./conversation-title";
import { findOwnedConversation, listRecentMessages } from "./conversations";
import { TUTOR_ROLE_INSTRUCTIONS } from "./instructions";
import { TutorModelOutputSchema, TutorRequestSchema, type TutorResult, type TutorSourceView } from "./types";

const TUTOR_SCHEMA_NAME = "tutor_response";
const GENERATION_FAILURE_MESSAGE = "Sorry, something went wrong generating a response. Please try again.";
const CONVERSATION_NOT_FOUND_MESSAGE = "Conversation not found.";

export interface TutorDependencies {
  llmProvider?: LLMProvider;
}

/** Drops the chunk's full text — see TutorSourceView's comment in types.ts. */
function toSourceViews(sources: AIContextSource[]): TutorSourceView[] {
  return sources.map(({ chunkId, materialId, courseId, score, page, slide, heading }) => ({
    chunkId,
    materialId,
    courseId,
    score,
    page,
    slide,
    heading,
  }));
}

/**
 * The tutor's single entry point, now conversation-aware. Every call
 * either resumes a verified, owned conversation or starts a new one —
 * there's no "stateless" mode left, since a conversation is cheap to
 * create and every message needs somewhere to live.
 *
 * Ordering matters here and is deliberate:
 *   1. Resolve/create the conversation, and load its bounded prior
 *      history, BEFORE saving anything new — so the question we're about
 *      to save is never counted as its own history.
 *   2. Save the user's message BEFORE calling the LLM — so the question
 *      survives even if generation fails below.
 *   3. Save the assistant's message ONLY after structured output has been
 *      validated — a failed or malformed generation never leaves a fake
 *      assistant message in the conversation.
 *
 * Concurrency: two simultaneous requests against the same conversation
 * are not locked against each other. Each TutorMessage insert is an
 * independent, atomic write — there's no shared mutable array being
 * read-modified-written — so the worst a race can do is interleave two
 * question/answer pairs in an unexpected order, a UX oddity, not
 * corruption. The primary defense is the UI disabling submission while a
 * request is in flight (see the tutor thread component); that is
 * sufficient here and a distributed lock would be solving a problem this
 * app doesn't have.
 */
export async function askTutor(userId: string, rawRequest: unknown, deps: TutorDependencies = {}): Promise<TutorResult> {
  const parsed = TutorRequestSchema.safeParse(rawRequest);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid request",
      conversationId: null,
      retrievalStatus: "no_relevant_sources",
      sources: [],
    };
  }
  const { question, materialId, courseId, conversationId: existingConversationId } = parsed.data;

  await connectToDatabase();

  const conversation = existingConversationId
    ? await findOwnedConversation(userId, existingConversationId)
    : await TutorConversation.create({
        userId,
        title: deriveConversationTitle(question),
        courseId: courseId ?? null,
        materialId: materialId ?? null,
      });

  if (!conversation) {
    // Either the conversationId doesn't exist, or it belongs to someone
    // else — findOwnedConversation deliberately can't tell us which (see
    // its own comment), and neither should this response.
    return {
      ok: false,
      error: CONVERSATION_NOT_FOUND_MESSAGE,
      conversationId: null,
      retrievalStatus: "no_relevant_sources",
      sources: [],
    };
  }
  const conversationId = conversation._id.toString();

  // A follow-up inherits the conversation's original scope unless this
  // specific question overrides it — so the two-pane UI's follow-up box
  // (which has no material/course picker of its own) still stays scoped.
  const effectiveMaterialId = materialId ?? conversation.materialId?.toString();
  const effectiveCourseId = courseId ?? conversation.courseId?.toString();

  const recentMessages = await listRecentMessages(userId, conversationId, CONVERSATION_POLICY.maxHistoryMessages);
  const conversationContext = boundConversationHistory(recentMessages);

  await TutorMessage.create({ conversationId: conversation._id, userId, role: "user", content: question });

  const structured = await askStructured(
    userId,
    { question, materialId: effectiveMaterialId, courseId: effectiveCourseId, conversationContext },
    TutorModelOutputSchema,
    TUTOR_SCHEMA_NAME,
    { llmProvider: deps.llmProvider, roleInstructions: TUTOR_ROLE_INSTRUCTIONS },
  );

  if (!structured.ok) {
    return {
      ok: false,
      error: GENERATION_FAILURE_MESSAGE,
      conversationId,
      retrievalStatus: structured.retrievalStatus,
      sources: toSourceViews(structured.sources),
    };
  }

  const sources = toSourceViews(structured.sources);
  await TutorMessage.create({
    conversationId: conversation._id,
    userId,
    role: "assistant",
    content: structured.data.answer,
    sources,
    retrievalStatus: structured.retrievalStatus,
  });
  await TutorConversation.updateOne({ _id: conversation._id, userId }, { $set: { updatedAt: new Date() } });

  return {
    ok: true,
    conversationId,
    answer: structured.data.answer,
    followUpQuestion: structured.data.followUpQuestion,
    retrievalStatus: structured.retrievalStatus,
    sources,
    model: structured.model,
  };
}
