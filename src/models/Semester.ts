import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface ISemester extends Document {
  userId: Types.ObjectId;
  academicYearId: Types.ObjectId;
  name: string;
  order: number;
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SemesterSchema = new Schema<ISemester>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    academicYearId: {
      type: Schema.Types.ObjectId,
      ref: "AcademicYear",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    order: { type: Number, required: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

SemesterSchema.index({ academicYearId: 1, name: 1 }, { unique: true });

export const Semester: Model<ISemester> =
  models.Semester ?? model<ISemester>("Semester", SemesterSchema);
