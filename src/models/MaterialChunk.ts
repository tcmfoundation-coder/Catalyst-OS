import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { EMBEDDING_STATUSES, type EmbeddingStatus } from "@/lib/embeddings/constants";

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
  // Embedding metadata. embeddingModel/embeddingDim record which model
  // produced `embedding` so a later model change never gets silently
  // treated as compatible with old vectors (staleness is derived by
  // comparing embeddingModel to lib/embeddings/constants' current model,
  // not stored as its own flag — see that file's comment). vectorLabel is
  // the integer id this chunk occupies in the HNSW index; null until
  // assigned. `embedding` is select:false since it's a 384-number array
  // that almost nothing reading a chunk for display needs.
  embedding: number[] | null;
  embeddingModel: string | null;
  embeddingDim: number | null;
  embeddingStatus: EmbeddingStatus;
  embeddingError: string | null;
  embeddedAt: Date | null;
  vectorLabel: number | null;
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
    embedding: { type: [Number], default: null, select: false },
    embeddingModel: { type: String, default: null },
    embeddingDim: { type: Number, default: null },
    embeddingStatus: { type: String, enum: EMBEDDING_STATUSES, required: true, default: "pending", index: true },
    embeddingError: { type: String, default: null },
    embeddedAt: { type: Date, default: null },
    // Deliberately no `default: null` here: a sparse index only excludes
    // documents where the field is *absent*, not documents that store an
    // explicit `null` — Mongoose's `default: null` would write that
    // explicit null into every chunk, so the "unique" part of the index
    // below would collide across every not-yet-embedded chunk. Leaving no
    // default means the key is genuinely missing until a real label is
    // assigned, which is what the sparse index needs.
    vectorLabel: { type: Number },
  },
  { timestamps: true },
);

MaterialChunkSchema.index({ materialId: 1, chunkIndex: 1 }, { unique: true });
MaterialChunkSchema.index({ vectorLabel: 1 }, { unique: true, sparse: true });

export const MaterialChunk: Model<IMaterialChunk> =
  models.MaterialChunk ?? model<IMaterialChunk>("MaterialChunk", MaterialChunkSchema);
