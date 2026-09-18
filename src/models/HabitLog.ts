import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IHabitLog extends Document {
  userId: Types.ObjectId;
  habitId: Types.ObjectId;
  // Calendar day (UTC midnight) the habit was completed on. The log row's
  // existence IS the "done" signal for that day — there's no separate
  // completed boolean to drift out of sync with it.
  date: Date;
  createdAt: Date;
  updatedAt: Date;
}

const HabitLogSchema = new Schema<IHabitLog>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    habitId: { type: Schema.Types.ObjectId, ref: "Habit", required: true, index: true },
    date: { type: Date, required: true },
  },
  { timestamps: true },
);

HabitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });

export const HabitLog: Model<IHabitLog> =
  models.HabitLog ?? model<IHabitLog>("HabitLog", HabitLogSchema);
