import "server-only";
import { connectToDatabase } from "@/lib/db";
import { UserAISettings } from "@/models/UserAISettings";
import { getConfiguredLLMProviderName, getLLMProvider, type LLMProviderName } from "./provider-factory";

export interface UserAIPreferences {
  voiceName: string;
  voiceRate: number;
  voicePitch: number;
  autoSpeak: boolean;
  responseLength: "concise" | "balanced" | "detailed";
  tutorTone: "supportive" | "direct" | "socratic";
}

export async function getUserLLMProvider(userId: string) {
  await connectToDatabase();
  const settings = await UserAISettings.findOne({ userId }).select("provider").lean();
  return getLLMProvider(settings?.provider ?? getConfiguredLLMProviderName());
}

export async function getUserPreferredProvider(userId: string): Promise<LLMProviderName> {
  await connectToDatabase();
  const settings = await UserAISettings.findOne({ userId }).select("provider").lean();
  return settings?.provider ?? getConfiguredLLMProviderName();
}

export async function getUserAIPreferences(userId: string): Promise<UserAIPreferences> {
  await connectToDatabase();
  const settings = await UserAISettings.findOne({ userId })
    .select("voiceName voiceRate voicePitch autoSpeak responseLength tutorTone")
    .lean();
  return {
    voiceName: settings?.voiceName ?? "",
    voiceRate: settings?.voiceRate ?? 1,
    voicePitch: settings?.voicePitch ?? 1,
    autoSpeak: settings?.autoSpeak ?? false,
    responseLength: settings?.responseLength ?? "balanced",
    tutorTone: settings?.tutorTone ?? "supportive",
  };
}
