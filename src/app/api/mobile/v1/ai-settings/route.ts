import { NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { getAvailableLLMProviders, getConfiguredLLMProviderName, type LLMProviderName } from "@/lib/ai/provider-factory";
import { authenticateMobileRequest } from "@/lib/mobile/auth";
import { mobileApiHeaders, mobileApiOptions } from "@/lib/mobile/cors";
import { UserAISettings } from "@/models/UserAISettings";

const ProviderSchema = z.enum(["anthropic", "gemini", "openai"]);
const PreferencesSchema = z.object({
  voiceName: z.string().max(160),
  voiceRate: z.number().min(0.75).max(1.25),
  voicePitch: z.number().min(0.75).max(1.25),
  autoSpeak: z.boolean(),
  responseLength: z.enum(["concise", "balanced", "detailed"]),
  tutorTone: z.enum(["supportive", "direct", "socratic"]),
});
const UpdateSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("provider"), provider: ProviderSchema }),
  z.object({ action: z.literal("resetProvider") }),
  z.object({ action: z.literal("preferences"), preferences: PreferencesSchema }),
]);

const DEFAULT_PREFERENCES = {
  voiceName: "",
  voiceRate: 1,
  voicePitch: 1,
  autoSpeak: false,
  responseLength: "balanced" as const,
  tutorTone: "supportive" as const,
};

export function OPTIONS(request: Request) {
  return mobileApiOptions(request);
}

export async function GET(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  await connectToDatabase();
  const settings = await UserAISettings.findOne({ userId: principal.userId })
    .select("provider voiceName voiceRate voicePitch autoSpeak responseLength tutorTone")
    .lean();
  const defaultProvider = getConfiguredLLMProviderName();

  return NextResponse.json({
    provider: settings?.provider ?? defaultProvider,
    defaultProvider,
    availableProviders: getAvailableLLMProviders(),
    preferences: {
      voiceName: settings?.voiceName ?? DEFAULT_PREFERENCES.voiceName,
      voiceRate: settings?.voiceRate ?? DEFAULT_PREFERENCES.voiceRate,
      voicePitch: settings?.voicePitch ?? DEFAULT_PREFERENCES.voicePitch,
      autoSpeak: settings?.autoSpeak ?? DEFAULT_PREFERENCES.autoSpeak,
      responseLength: settings?.responseLength ?? DEFAULT_PREFERENCES.responseLength,
      tutorTone: settings?.tutorTone ?? DEFAULT_PREFERENCES.tutorTone,
    },
  }, { headers });
}

export async function PATCH(request: Request) {
  const headers = mobileApiHeaders(request);
  const principal = await authenticateMobileRequest(request);
  if (!principal) return NextResponse.json({ error: "Unauthenticated" }, { status: 401, headers });

  const body = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "One or more AI settings are invalid." }, { status: 400, headers });

  await connectToDatabase();
  if (parsed.data.action === "preferences") {
    await UserAISettings.findOneAndUpdate(
      { userId: principal.userId },
      { $set: parsed.data.preferences, $setOnInsert: { userId: principal.userId, provider: getConfiguredLLMProviderName() } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  } else {
    const provider: LLMProviderName = parsed.data.action === "resetProvider"
      ? getConfiguredLLMProviderName()
      : parsed.data.provider;
    if (parsed.data.action === "provider" && !getAvailableLLMProviders().includes(provider)) {
      return NextResponse.json({ error: "That provider is not configured by your system administrator." }, { status: 400, headers });
    }
    await UserAISettings.findOneAndUpdate(
      { userId: principal.userId },
      { $set: { provider }, $setOnInsert: { userId: principal.userId } },
      { upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  }

  return NextResponse.json({ ok: true }, { headers });
}
