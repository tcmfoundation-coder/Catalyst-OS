import "server-only";
import { AnthropicProvider } from "./anthropic-provider";
import { GeminiProvider } from "./gemini-provider";
import { OpenAIProvider } from "./openai-provider";
import { LLMProviderError, type LLMProvider } from "./llm-provider";

export type LLMProviderName = "anthropic" | "gemini" | "openai";

export function getConfiguredLLMProviderName(preferred?: string | null): LLMProviderName {
  const configured = (preferred ?? process.env.LLM_PROVIDER ?? "anthropic").trim().toLowerCase();
  if (configured === "anthropic" || configured === "gemini" || configured === "openai") return configured;
  throw new LLMProviderError("Invalid LLM_PROVIDER. Choose anthropic, gemini, or openai.");
}

export function isLLMProviderConfigured(provider: LLMProviderName): boolean {
  switch (provider) {
    case "anthropic": return Boolean(process.env.ANTHROPIC_API_KEY?.trim());
    case "gemini": return Boolean(process.env.GEMINI_API_KEY?.trim());
    case "openai": return Boolean(process.env.OPENAI_API_KEY?.trim());
  }
}

export function getAvailableLLMProviders(): LLMProviderName[] {
  return (["anthropic", "gemini", "openai"] as const).filter(isLLMProviderConfigured);
}

/** Selects the server-side provider; provider keys are never sent to clients. */
export function getLLMProvider(preferred?: string | null): LLMProvider {
  const providerName = getConfiguredLLMProviderName(preferred);
  if (!isLLMProviderConfigured(providerName)) {
    throw new LLMProviderError(`${providerName} is not configured on this server`);
  }
  switch (providerName) {
    case "anthropic":
      return new AnthropicProvider();
    case "gemini":
      return new GeminiProvider();
    case "openai":
      return new OpenAIProvider();
  }
}
