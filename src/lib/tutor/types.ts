import { z } from "zod";
import type { RetrievalStatus } from "@/lib/ai/types";
import type { ITutorMessageSource } from "@/models/TutorMessage";

/**
 * The AI Tutor's own, narrower public contract — a subset of what
 * AIOrchestrator.askStructured() accepts. Validating against this first
 * (before ever reaching the orchestrator) keeps the tutor's allowed
 * inputs and error messages tutor-specific, even though it ultimately
 * forwards to the same underlying request shape.
 *
 * There is deliberately no `conversationContext` field here anymore: a
 * caller cannot hand the tutor arbitrary "history" text directly. Once a
 * conversation is persisted, history can only come from a verified
 * database record — see conversations.ts's ownership check and
 * conversation-context.ts's bounding — never from whatever the browser
 * sends alongside the question.
 */
export const TutorRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000, "Question is too long"),
  materialId: z.string().optional(),
  courseId: z.string().optional(),
  conversationId: z.string().optional(),
});
export type TutorRequest = z.infer<typeof TutorRequestSchema>;

/**
 * What the model itself is asked to produce — deliberately minimal.
 * Source metadata and retrieval status are never part of this: they
 * always come from ContextAssembler's own output (see service.ts), so
 * the model has no field to manufacture a citation into even if it
 * wanted to.
 */
export const TutorModelOutputSchema = z.object({
  answer: z.string().min(1),
  followUpQuestion: z.string().nullable(),
});
export type TutorModelOutput = z.infer<typeof TutorModelOutputSchema>;

/**
 * The citation-facing view of a source: the same shape persisted onto a
 * TutorMessage (see models/TutorMessage.ts), deliberately without the
 * chunk's full `text` that AIContextSource carries internally. The tutor
 * never needs to ship raw retrieved text to the browser — chunkId +
 * location metadata is enough to show and later re-look-up a citation —
 * and using one identical type for both the live askTutor() result and a
 * reloaded conversation message means the UI renders both the same way.
 */
export type TutorSourceView = ITutorMessageSource;

/**
 * The tutor's public result shape — kept in this "server-only"-free file
 * (rather than service.ts) so a Client Component can import the type
 * alone without any risk of pulling server-only code into the browser
 * bundle. Sources always come from ContextAssembler's own output, never
 * from the model. Every result — success or failure — carries the
 * conversationId it belongs to, since askTutor() always resolves or
 * creates a conversation before it can fail or succeed past validation.
 */
export type TutorFailure = {
  ok: false;
  error: string;
  conversationId: string | null;
  retrievalStatus: RetrievalStatus;
  sources: TutorSourceView[];
};

export type TutorResult =
  | {
      ok: true;
      conversationId: string;
      answer: string;
      followUpQuestion: string | null;
      retrievalStatus: RetrievalStatus;
      sources: TutorSourceView[];
      model: string;
    }
  | TutorFailure;
