import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import { MATERIAL_FORMATS, MATERIAL_STATUSES, type MaterialFormat, type MaterialStatus } from "@/lib/study-materials/constants";

export interface IStudyMaterial extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  originalFilename: string;
  format: MaterialFormat;
  fileSizeBytes: number;
  // Where the original file lives in object storage. Only ever set
  // server-side (see lib/study-materials/constants.ts's
  // buildMaterialStorageKey) — never accepted directly from a client.
  storageKey: string;
  status: MaterialStatus;
  processingError: string | null;
  // Populated once processing succeeds; null until then.
  title: string | null;
  pageCount: number | null;
  slideCount: number | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudyMaterialSchema = new Schema<IStudyMaterial>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    originalFilename: { type: String, required: true, trim: true },
    format: { type: String, enum: MATERIAL_FORMATS, required: true },
    fileSizeBytes: { type: Number, required: true, min: 1 },
    storageKey: { type: String, required: true, unique: true },
    status: { type: String, enum: MATERIAL_STATUSES, required: true, default: "uploaded" },
    processingError: { type: String, default: null },
    title: { type: String, default: null, trim: true },
    pageCount: { type: Number, default: null },
    slideCount: { type: Number, default: null },
  },
  { timestamps: true },
);

StudyMaterialSchema.index({ userId: 1, createdAt: -1 });

export const StudyMaterial: Model<IStudyMaterial> =
  models.StudyMaterial ?? model<IStudyMaterial>("StudyMaterial", StudyMaterialSchema);
