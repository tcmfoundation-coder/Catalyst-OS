import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ generateContent: vi.fn() }));

vi.mock("@google/genai", () => ({
  ApiError: class ApiError extends Error {
    constructor(public status: number, message: string) { super(message); }
  },
  GoogleGenAI: class GoogleGenAI {
    models = { generateContent: mocks.generateContent };
  },
  ThinkingLevel: { LOW: "low", MEDIUM: "medium", HIGH: "high" },
}));

import { GeminiProvider } from "./gemini-provider";
import { getConfiguredLLMProviderName } from "./provider-factory";
import { LLMProviderError, type StructuredLLMGenerationRequest } from "./llm-provider";

const request: StructuredLLMGenerationRequest = {
  systemInstructions: "Fixed system instructions",
  userInput: "A grounded question",
  responseSchemaName: "tutor_response",
  responseJsonSchema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
};

describe("GeminiProvider", () => {
  beforeEach(() => {
    vi.stubEnv("GEMINI_API_KEY", "test-key");
    vi.stubEnv("GEMINI_MODEL", "gemini-test");
    vi.stubEnv("GEMINI_THINKING_LEVEL", "high");
    mocks.generateContent.mockReset();
  });

  afterEach(() => vi.unstubAllEnvs());

  it("selects only explicitly supported providers", () => {
    vi.stubEnv("LLM_PROVIDER", "gemini");
    expect(getConfiguredLLMProviderName()).toBe("gemini");
    vi.stubEnv("LLM_PROVIDER", "anthropic");
    expect(getConfiguredLLMProviderName()).toBe("anthropic");
    vi.stubEnv("LLM_PROVIDER", "untrusted-provider");
    expect(() => getConfiguredLLMProviderName()).toThrow(LLMProviderError);
  });

  it("sends plain text requests with the system boundary and returns usage/model metadata", async () => {
    mocks.generateContent.mockResolvedValue({
      text: "A grounded answer",
      modelVersion: "gemini-test-version",
      candidates: [{ finishReason: "STOP" }],
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8 },
    });

    const result = await new GeminiProvider().generate(request);

    expect(result).toMatchObject({
      text: "A grounded answer",
      model: "gemini-test-version",
      stopReason: "STOP",
      usage: { inputTokens: 12, outputTokens: 8 },
    });
    expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      model: "gemini-test",
      contents: request.userInput,
      config: expect.objectContaining({ systemInstruction: request.systemInstructions }),
    }));
  });

  it("requests schema-constrained JSON and parses it for the shared Zod validation boundary", async () => {
    mocks.generateContent.mockResolvedValue({ text: '{"answer":"From the material"}', candidates: [{ finishReason: "STOP" }] });

    const result = await new GeminiProvider().generateStructured(request);

    expect(result.structuredOutput).toEqual({ answer: "From the material" });
    expect(mocks.generateContent).toHaveBeenCalledWith(expect.objectContaining({
      config: expect.objectContaining({ responseMimeType: "application/json", responseJsonSchema: request.responseJsonSchema }),
    }));
  });

  it("fails clearly when no server-side API key is configured", async () => {
    vi.stubEnv("GEMINI_API_KEY", "");
    await expect(new GeminiProvider().generate(request)).rejects.toThrow("GEMINI_API_KEY is not configured");
    expect(mocks.generateContent).not.toHaveBeenCalled();
  });

  it("rejects malformed structured output without exposing provider response text", async () => {
    mocks.generateContent.mockResolvedValue({ text: "not-json-secret-content" });
    await expect(new GeminiProvider().generateStructured(request)).rejects.toThrow(LLMProviderError);
    await expect(new GeminiProvider().generateStructured(request)).rejects.not.toThrow("not-json-secret-content");
  });

  it("does not include provider error bodies in safe error messages", async () => {
    mocks.generateContent.mockRejectedValue(new Error("private request details"));
    await expect(new GeminiProvider().generate(request)).rejects.toThrow("Check the server logs and provider configuration");
  });
});
