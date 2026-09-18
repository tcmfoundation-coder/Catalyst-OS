import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { RETRIEVAL_STATUSES, type RetrievalStatus } from "@/lib/ai/types";

/**
 * Messages are their own collection, not an array embedded in
 * TutorConversation, for the same reason MaterialChunk is separate from
 * StudyMaterial: an ever-growing embedded array risks MongoDB's 16MB
 * document limit on a long-lived conversation, every append would rewrite
 * the whole array, and "give me the last N messages" would otherwise mean
 * loading and deserializing the entire history just to read the tail.
 * A separate, indexed collection makes bounded history (see
 * lib/tutor/conversation-context.ts) a cheap, ordinary query.
 *
 * Sources deliberately carry only citation metadata (chunkId, materialId,
 * courseId, page, slide, heading, score) — never the chunk's text. The
 * text is retrieval-time context for generating *this* answer, not part
 * of the conversation record; MaterialChunk (looked up by chunkId) stays
 * the one place chunk text lives. This also means a source can never
 * silently go stale into "wrong but plausible-looking" answer text
 * baked into history — only the citation pointer is kept.
 */
export const TUTOR_MESSAGE_ROLES = ["user", "assistant"] as const;
export type TutorMessageRole = (typeof TUTOR_MESSAGE_ROLES)[number];

export interface ITutorMessageSource {
  chunkId: string;
  materialId: string;
  courseId: string | null;
  page: number | null;
  slide: number | null;
  heading: string | null;
  score: number;
}

const TutorMessageSourceSchema = new Schema<ITutorMessageSource>(
  {
    chunkId: { type: String, required: true },
    materialId: { type: String, required: true },
    courseId: { type: String, default: null },
    page: { type: Number, default: null },
    slide: { type: Number, default: null },
    heading: { type: String, default: null },
    score: { type: Number, required: true },
  },
  { _id: false },
);

export interface ITutorMessage extends Document {
  conversationId: Types.ObjectId;
  userId: Types.ObjectId;
  role: TutorMessageRole;
  content: string;
  // Only meaningful for assistant messages — a user message never has
  // sources or a retrieval status of its own.
  sources: ITutorMessageSource[];
  retrievalStatus: RetrievalStatus | null;
  createdAt: Date;
  updatedAt: Date;
}

const TutorMessageSchema = new Schema<ITutorMessage>(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "TutorConversation", required: true, index: true },
    // Denormalized from the conversation — same pattern as every other
    // ownership-scoped model in this app — so a message lookup can
    // enforce "this message's conversation belongs to this user" without
    // a second query, and a compromised/mistaken conversationId alone is
    // never enough to read someone else's message.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    role: { type: String, enum: TUTOR_MESSAGE_ROLES, required: true },
    content: { type: String, required: true },
    sources: { type: [TutorMessageSourceSchema], default: [] },
    retrievalStatus: { type: String, enum: RETRIEVAL_STATUSES, default: null },
  },
  { timestamps: true },
);

// The one real query pattern: "this conversation's messages, in order."
TutorMessageSchema.index({ conversationId: 1, createdAt: 1 });

export const TutorMessage: Model<ITutorMessage> =
  models.TutorMessage ?? model<ITutorMessage>("TutorMessage", TutorMessageSchema);
