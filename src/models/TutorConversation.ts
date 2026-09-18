import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

/**
 * A conversation is deliberately just an identity + a few scoping/display
 * fields — the actual back-and-forth lives in TutorMessage (see that
 * file's comment for why they're separate collections, not an embedded
 * array). This document exists so the tutor UI has something to list,
 * title, and delete; it owns no message content itself.
 */
export interface ITutorConversation extends Document {
  userId: Types.ObjectId;
  title: string;
  courseId: Types.ObjectId | null;
  materialId: Types.ObjectId | null;
  createdAt: Date;
  updatedAt: Date;
}

const TutorConversationSchema = new Schema<ITutorConversation>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true },
    // The scope the conversation started with (if any) — same optional-
    // scoping pattern as Task/StudySession/LearningMemory's courseId.
    // Not re-validated on every message; ownership of courseId/materialId
    // is checked once, when the conversation is created.
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    materialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial", default: null },
  },
  { timestamps: true },
);

// Listing "this user's conversations, most recently active first" is the
// only real query pattern this model needs.
TutorConversationSchema.index({ userId: 1, updatedAt: -1 });

export const TutorConversation: Model<ITutorConversation> =
  models.TutorConversation ?? model<ITutorConversation>("TutorConversation", TutorConversationSchema);
