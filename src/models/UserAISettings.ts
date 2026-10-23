import { Schema, model, models, type Document, type Model, type Types } from "mongoose";
import type { LLMProviderName } from "@/lib/ai/provider-factory";

export interface IUserAISettings extends Document {
  userId: Types.ObjectId;
  provider: LLMProviderName;
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
  autoSpeak: boolean;
  responseLength: "concise" | "balanced" | "detailed";
  tutorTone: "supportive" | "direct" | "socratic";
  createdAt: Date;
  updatedAt: Date;
}

const UserAISettingsSchema = new Schema<IUserAISettings>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    provider: { type: String, enum: ["anthropic", "gemini", "openai"], required: true },
    voiceName: { type: String, default: "", maxlength: 160 },
    voiceRate: { type: Number, min: 0.75, max: 1.25, default: 1 },
    voicePitch: { type: Number, min: 0.75, max: 1.25, default: 1 },
    autoSpeak: { type: Boolean, default: false },
    responseLength: { type: String, enum: ["concise", "balanced", "detailed"], default: "balanced" },
    tutorTone: { type: String, enum: ["supportive", "direct", "socratic"], default: "supportive" },
  },
  { timestamps: true },
);

export const UserAISettings: Model<IUserAISettings> =
  models.UserAISettings ?? model<IUserAISettings>("UserAISettings", UserAISettingsSchema);
