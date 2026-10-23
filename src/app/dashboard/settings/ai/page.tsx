import { requireUserId } from "@/lib/dal";
import { getAvailableLLMProviders, getConfiguredLLMProviderName } from "@/lib/ai/provider-factory";
import { getUserAIPreferences, getUserPreferredProvider } from "@/lib/ai/user-provider";
import { AIProviderSettings } from "./provider-settings";

const PROVIDER_LABELS = {
  anthropic: "Anthropic Claude",
  gemini: "Google Gemini",
  openai: "OpenAI",
} as const;

export default async function AISettingsPage() {
  const userId = await requireUserId();
  const [selected, preferences] = await Promise.all([
    getUserPreferredProvider(userId),
    getUserAIPreferences(userId),
  ]);
  const available = getAvailableLLMProviders();
  const defaultProvider = getConfiguredLLMProviderName();
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <header>
        <p className="font-mono text-xs tracking-[0.18em] text-accent uppercase">System preferences</p>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">AI control panel</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Set your AI provider, response style, and the voice used when Catalyst speaks. Preferences are saved to your account.
        </p>
      </header>
      <div className="rounded-xl border border-line bg-surface p-5 sm:p-6">
        <AIProviderSettings
          initialSelected={selected}
          available={available}
          defaultProvider={defaultProvider}
          labels={PROVIDER_LABELS}
          initialPreferences={preferences}
        />
        {available.length === 0 && (
          <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-foreground">
            No AI provider is configured on this server yet. Ask the administrator to configure one.
          </p>
        )}
      </div>
      <p className="text-xs leading-5 text-muted">
        Provider API keys are managed on the server and are never shown here. Switching providers can change data processing terms and usage costs.
      </p>
    </section>
  );
}
