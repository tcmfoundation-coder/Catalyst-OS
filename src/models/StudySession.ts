import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IStudySession extends Document {
  userId: Types.ObjectId;
  courseId: Types.ObjectId | null;
  date: Date;
  durationMinutes: number;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const StudySessionSchema = new Schema<IStudySession>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    // Optional: a study session doesn't have to be tied to a course. When
    // set, it must be validated at the application layer (see
    // lib/actions/course-ownership.ts) to belong to the same user.
    courseId: { type: Schema.Types.ObjectId, ref: "Course", default: null, index: true },
    date: { type: Date, required: true },
    durationMinutes: { type: Number, required: true, min: 1, max: 1440 },
    notes: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

StudySessionSchema.index({ userId: 1, date: 1 });

export const StudySession: Model<IStudySession> =
  models.StudySession ?? model<IStudySession>("StudySession", StudySessionSchema);
