import { Schema, model, models, type Document, type Model, type Types } from "mongoose";

export interface IHabit extends Document {
  userId: Types.ObjectId;
  name: string;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const HabitSchema = new Schema<IHabit>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: null, trim: true },
  },
  { timestamps: true },
);

export const Habit: Model<IHabit> = models.Habit ?? model<IHabit>("Habit", HabitSchema);
