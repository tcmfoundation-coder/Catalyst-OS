import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IMaterialChunk extends Document {
  materialId: Types.ObjectId;
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  chunkIndex: number;
  text: string;
  heading: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  slideStart: number | null;
  slideEnd: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const MaterialChunkSchema = new Schema<IMaterialChunk>(
  {
    materialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial", required: true, index: true },
    // Denormalized from the material — same pattern as Task/StudySession/
    // LearningMemory — so every ownership-scoped query filters on userId
    // directly instead of joining through StudyMaterial first.
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    heading: { type: String, default: null },
    pageStart: { type: Number, default: null },
    pageEnd: { type: Number, default: null },
    slideStart: { type: Number, default: null },
    slideEnd: { type: Number, default: null },
  },
  { timestamps: true },
);

MaterialChunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true });

export const MaterialChunk: Model<IMaterialChunk> =
  models.MaterialChunk ?? model<IMaterialChunk>("MaterialChunk", MaterialChunkSchema);
