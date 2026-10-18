import "server-only";
import { connectToDatabase } from "@/lib/db";
import { UserAISettings } from "@/models/UserAISettings";
import { getConfiguredLLMProviderName, getLLMProvider, type LLMProviderName } from "./provider-factory";

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
