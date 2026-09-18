import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IAcademicYear extends Document {
  userId: Types.ObjectId;
  label: string;
  startDate?: Date;
  endDate?: Date;
  isCurrent: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AcademicYearSchema = new Schema<IAcademicYear>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    label: { type: String, required: true, trim: true },
    startDate: { type: Date },
    endDate: { type: Date },
    isCurrent: { type: Boolean, default: false },
  },
  { timestamps: true },
);

AcademicYearSchema.index({ userId: 1, label: 1 }, { unique: true });

export const AcademicYear: Model<IAcademicYear> =
  models.AcademicYear ?? model<IAcademicYear>("AcademicYear", AcademicYearSchema);
