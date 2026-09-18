import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface ICourse extends Document {
  userId: Types.ObjectId;
  semesterId: Types.ObjectId;
  code: string;
  title: string;
  creditUnits: number;
  grade: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const CourseSchema = new Schema<ICourse>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    semesterId: { type: Schema.Types.ObjectId, ref: "Semester", required: true, index: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    title: { type: String, required: true, trim: true },
    creditUnits: { type: Number, required: true, min: 1 },
    // Letter grade, validated against the configured grading scale at the
    // application layer (see lib/academic/grading-scale.ts) rather than a
    // hardcoded schema enum, so the scale can change without a migration.
    grade: { type: String, default: null, uppercase: true, trim: true },
  },
  { timestamps: true },
);

CourseSchema.index({ semesterId: 1, code: 1 }, { unique: true });

export const Course: Model<ICourse> = models.Course ?? model<ICourse>("Course", CourseSchema);
