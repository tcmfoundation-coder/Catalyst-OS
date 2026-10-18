"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUserId } from "@/lib/dal";
import { connectToDatabase } from "@/lib/db";
import { getAvailableLLMProviders } from "@/lib/ai/provider-factory";
import { UserAISettings } from "@/models/UserAISettings";

const ProviderSchema = z.enum(["anthropic", "gemini", "openai"]);

export async function setAIProviderAction(value: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const userId = await requireUserId();
  const parsed = ProviderSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: "Choose a supported AI provider." };

  const available = getAvailableLLMProviders();
  if (!available.includes(parsed.data)) {
    return { ok: false, error: "That provider is not configured by your system administrator." };
  }

  await connectToDatabase();
  await UserAISettings.findOneAndUpdate(
    { userId },
    { $set: { provider: parsed.data }, $setOnInsert: { userId } },
    { upsert: true, runValidators: true, setDefaultsOnInsert: true },
  );
  revalidatePath("/dashboard/settings/ai");
  return { ok: true };
}

export async function resetAIProviderAction(): Promise<void> {
  const userId = await requireUserId();
  await connectToDatabase();
  await UserAISettings.deleteOne({ userId });
  revalidatePath("/dashboard/settings/ai");
}

