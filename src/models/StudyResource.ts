import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

/**
 * One persistence model for every AI-generated learning resource type,
 * discriminated by `type` — "notes" today, flashcards/quizzes later —
 * rather than a separate collection per type. `content` is intentionally
 * loose (Mixed): each type's actual shape is enforced by its own Zod
 * schema at the application boundary (see study-resources/notes-schema.ts
 * for "notes"), both when a model's output is validated before it's ever
 * persisted and whenever a document is read back out. That's the same
 * division of labor this app always uses between MongoDB (flexible
 * storage) and Zod (the actual shape guarantee) — see e.g. LearningMemory.
 *
 * Sources carry only citation metadata (chunkId/materialId/courseId/
 * page/slide/heading/score) — never the chunk's text, embedding, or
 * vectorLabel. Same reasoning as TutorMessage's sources: the retrieved
 * text was generation-time context for producing this content, not part
 * of the durable record; MaterialChunk (looked up by chunkId) stays the
 * one place chunk text lives.
 */
export const STUDY_RESOURCE_TYPES = ["notes"] as const;
export type StudyResourceType = (typeof STUDY_RESOURCE_TYPES)[number];

export interface IStudyResourceSource {
  chunkId: string;
  materialId: string;
  courseId: string | null;
  page: number | null;
  slide: number | null;
  heading: string | null;
  score: number;
}

export interface IStudyResource extends Document {
  userId: Types.ObjectId;
  type: StudyResourceType;
  title: string;
  materialId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  content: Record<string, unknown>;
  sources: IStudyResourceSource[];
  createdAt: Date;
  updatedAt: Date;
}

const StudyResourceSourceSchema = new Schema<IStudyResourceSource>(
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

const StudyResourceSchema = new Schema<IStudyResource>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: STUDY_RESOURCE_TYPES, required: true },
    // Denormalized up from `content` for cheap listing (e.g. a resource
    // list page) without dereferencing into the type-specific payload.
    title: { type: String, required: true, trim: true },
    materialId: { type: Schema.Types.ObjectId, ref: "StudyMaterial", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null },
    content: { type: Schema.Types.Mixed, required: true },
    sources: { type: [StudyResourceSourceSchema], default: [] },
  },
  { timestamps: true },
);

// "This user's resources, optionally for one material, most recent first"
// is the one real query pattern the UI needs.
StudyResourceSchema.index({ userId: 1, materialId: 1, createdAt: -1 });

export const StudyResource: Model<IStudyResource> =
  models.StudyResource ?? model<IStudyResource>("StudyResource", StudyResourceSchema);
