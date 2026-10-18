import "server-only";
import { ApiError, GoogleGenAI, ThinkingLevel as GeminiThinkingLevel } from "@google/genai";
import { DEFAULT_GEMINI_MODEL, DEFAULT_MAX_OUTPUT_TOKENS } from "./constants";
import {
  LLMProviderError,
  type LLMGenerationRequest,
  type LLMGenerationResult,
  type LLMProvider,
  type StructuredLLMGenerationRequest,
  type StructuredLLMGenerationResult,
} from "./llm-provider";

const THINKING_LEVELS = ["low", "medium", "high"] as const;
type ThinkingLevel = (typeof THINKING_LEVELS)[number];

const THINKING_LEVEL_MAP: Record<ThinkingLevel, GeminiThinkingLevel> = {
  low: GeminiThinkingLevel.LOW,
  medium: GeminiThinkingLevel.MEDIUM,
  high: GeminiThinkingLevel.HIGH,
};

function getModel(): string {
  return process.env.GEMINI_MODEL?.trim() || process.env.LLM_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
}

function getThinkingLevel(): ThinkingLevel {
  const level = process.env.GEMINI_THINKING_LEVEL?.trim() || process.env.LLM_REASONING_EFFORT?.trim() || "high";
  if ((THINKING_LEVELS as readonly string[]).includes(level)) return level as ThinkingLevel;
  throw new LLMProviderError("Invalid Gemini thinking level. Use low, medium, or high.");
}

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) throw new LLMProviderError("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey });
}

function describeError(error: unknown): string {
  // Do not return arbitrary SDK messages: they may contain request details.
  if (error instanceof ApiError) return `Gemini API error (HTTP ${error.status})`;
  return "Gemini request failed. Check the server logs and provider configuration.";
}

function responseText(text: string | undefined): string {
  if (typeof text !== "string" || !text.trim()) {
    throw new LLMProviderError("Gemini returned no text content");
  }
  return text;
}

function resultUsage(response: { usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number } }) {
  return {
    inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
    outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
  };
}

export class GeminiProvider implements LLMProvider {
  async generate(request: LLMGenerationRequest): Promise<LLMGenerationResult> {
    try {
      const response = await getClient().models.generateContent({
        model: request.model ?? getModel(),
        contents: request.userInput,
        config: {
          systemInstruction: request.systemInstructions,
          maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL_MAP[getThinkingLevel()] },
        },
      });
      return {
        text: responseText(response.text),
        model: response.modelVersion ?? request.model ?? getModel(),
        stopReason: response.candidates?.[0]?.finishReason ?? "unknown",
        usage: resultUsage(response),
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(describeError(error), error);
    }
  }

  async generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult> {
    try {
      const response = await getClient().models.generateContent({
        model: request.model ?? getModel(),
        contents: request.userInput,
        config: {
          systemInstruction: request.systemInstructions,
          maxOutputTokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
          thinkingConfig: { thinkingLevel: THINKING_LEVEL_MAP[getThinkingLevel()] },
          responseMimeType: "application/json",
          responseJsonSchema: request.responseJsonSchema,
        },
      });
      const text = responseText(response.text);
      let structuredOutput: unknown;
      try {
        structuredOutput = JSON.parse(text);
      } catch (error) {
        throw new LLMProviderError("Gemini returned invalid JSON for a structured response", error);
      }
      return {
        text,
        structuredOutput,
        model: response.modelVersion ?? request.model ?? getModel(),
        stopReason: response.candidates?.[0]?.finishReason ?? "unknown",
        usage: resultUsage(response),
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(describeError(error), error);
    }
  }
}
