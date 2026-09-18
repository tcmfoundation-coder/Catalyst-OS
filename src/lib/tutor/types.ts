import { z } from "zod";
import { ConversationTurnSchema, type AIContextSource, type RetrievalStatus } from "@/lib/ai/types";

/**
 * The AI Tutor's own, narrower public contract — a subset of what
 * AIOrchestrator.askStructured() accepts. Validating against this first
 * (before ever reaching the orchestrator) keeps the tutor's allowed
 * inputs and error messages tutor-specific, even though it ultimately
 * forwards to the same underlying request shape.
 */
export const TutorRequestSchema = z.object({
  question: z.string().trim().min(1, "Question is required").max(2000, "Question is too long"),
  materialId: z.string().optional(),
  courseId: z.string().optional(),
  conversationContext: z.array(ConversationTurnSchema).optional(),
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
 * The tutor's public result shape — kept in this "server-only"-free file
 * (rather than service.ts) so a Client Component can import the type
 * alone without any risk of pulling server-only code into the browser
 * bundle. Reuses AIContextSource as-is: sources always come from
 * ContextAssembler's own output, never from the model.
 */
export type TutorFailure = {
  ok: false;
  error: string;
  retrievalStatus: RetrievalStatus;
  sources: AIContextSource[];
};

export type TutorResult =
  | {
      ok: true;
      answer: string;
      followUpQuestion: string | null;
      retrievalStatus: RetrievalStatus;
      sources: AIContextSource[];
      model: string;
    }
  | TutorFailure;
