import { z } from "zod";

/**
 * The structured shapes ContextAssembler produces and PromptBuilder
 * consumes. Nothing downstream of ContextAssembler.build() should accept
 * a loosely-typed object here — see that file's docstring.
 */

export const RETRIEVAL_STATUSES = ["ok", "no_relevant_sources"] as const;
export type RetrievalStatus = (typeof RETRIEVAL_STATUSES)[number];

export const AIContextSourceSchema = z.object({
  chunkId: z.string(),
  materialId: z.string(),
  courseId: z.string().nullable(),
  text: z.string(),
  score: z.number(),
  page: z.number().nullable(),
  slide: z.number().nullable(),
  heading: z.string().nullable(),
});
export type AIContextSource = z.infer<typeof AIContextSourceSchema>;

export const AcademicContextSchema = z.object({
  course: z
    .object({ id: z.string(), code: z.string(), title: z.string(), grade: z.string().nullable() })
    .nullable()
    .optional(),
  currentAcademicYear: z.object({ id: z.string(), label: z.string() }).nullable().optional(),
  currentSemester: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  upcomingTasks: z
    .array(z.object({ id: z.string(), title: z.string(), dueDate: z.string().nullable(), priority: z.string() }))
    .optional(),
  recentMemories: z.array(z.object({ id: z.string(), content: z.string(), category: z.string() })).optional(),
});
export type AcademicContext = z.infer<typeof AcademicContextSchema>;

export const ConversationTurnSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string(),
});
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;

export const AIContextSchema = z.object({
  question: z.string(),
  retrievalStatus: z.enum(RETRIEVAL_STATUSES),
  sources: z.array(AIContextSourceSchema),
  academicContext: AcademicContextSchema.nullable().optional(),
  conversationContext: z.array(ConversationTurnSchema).optional(),
});
export type AIContext = z.infer<typeof AIContextSchema>;
