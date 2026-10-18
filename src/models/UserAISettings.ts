import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import type { LLMProviderName } from "@/lib/ai/provider-factory";

export interface IUserAISettings extends Document {
  userId: Types.ObjectId;
  provider: LLMProviderName;
  createdAt: Date;
  updatedAt: Date;
}

const UserAISettingsSchema = new Schema<IUserAISettings>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    provider: { type: String, enum: ["anthropic", "gemini", "openai"], required: true },
  },
  { timestamps: true },
);

export const UserAISettings: Model<IUserAISettings> =
  models.UserAISettings ?? model<IUserAISettings>("UserAISettings", UserAISettingsSchema);
