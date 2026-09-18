import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { MEMORY_CATEGORIES, type MemoryCategory } from "@/lib/learning-memories/constants";

export interface ILearningMemory extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  content: string;
  category: MemoryCategory;
  createdAt: Date;
  updatedAt: Date;
}

const LearningMemorySchema = new Schema<ILearningMemory>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Optional "context" for the memory — which course it relates to, if
    // any. Ownership is validated at the application layer (see
    // lib/actions/course-ownership.ts) just like Tasks and StudySessions.
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    content: { type: String, required: true, trim: true },
    category: { type: String, enum: MEMORY_CATEGORIES, required: true, default: "general" },
  },
  { timestamps: true },
);

LearningMemorySchema.index({ userId: 1, createdAt: -1 });

export const LearningMemory: Model<ILearningMemory> =
  models.LearningMemory ?? model<ILearningMemory>("LearningMemory", LearningMemorySchema);
