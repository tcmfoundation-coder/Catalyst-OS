import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.stubGlobal("fetch", mocks.fetch);

import { OpenAIProvider } from "./openai-provider";
import { getConfiguredLLMProviderName } from "./provider-factory";
import { LLMProviderError, type StructuredLLMGenerationRequest } from "./llm-provider";

const request: StructuredLLMGenerationRequest = {
  systemInstructions: "Fixed system instructions",
  userInput: "A grounded question",
  responseSchemaName: "tutor_response",
  responseJsonSchema: { type: "object", properties: { answer: { type: "string" } }, required: ["answer"] },
};

describe("OpenAIProvider", () => {
  beforeEach(() => {
    vi.stubEnv("OPENAI_API_KEY", "test-key");
    vi.stubEnv("OPENAI_MODEL", "gpt-test");
    vi.stubEnv("OPENAI_REASONING_EFFORT", "medium");
    mocks.fetch.mockReset();
  });
  afterEach(() => vi.unstubAllEnvs());

  it("selects OpenAI as an explicitly supported provider", () => {
    vi.stubEnv("LLM_PROVIDER", "openai");
    expect(getConfiguredLLMProviderName()).toBe("openai");
  });

  it("sends plain text requests to the Responses API and maps usage", async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      model: "gpt-test",
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "A grounded answer" }] }],
      usage: { input_tokens: 11, output_tokens: 7 },
    }));

    const result = await new OpenAIProvider().generate(request);
    expect(result).toMatchObject({
      text: "A grounded answer",
      model: "gpt-test",
      stopReason: "completed",
      usage: { inputTokens: 11, outputTokens: 7 },
    });
    expect(mocks.fetch).toHaveBeenCalledWith("https://api.openai.com/v1/responses", expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer test-key" }),
      body: expect.stringContaining('"instructions":"Fixed system instructions"'),
    }));
  });

  it("requests strict JSON Schema output and parses the returned object", async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      output: [{ type: "message", content: [{ type: "output_text", text: '{"answer":"From the material"}' }] }],
    }));

    const result = await new OpenAIProvider().generateStructured(request);
    expect(result.structuredOutput).toEqual({ answer: "From the material" });
    const body = JSON.parse(mocks.fetch.mock.calls[0][1].body as string);
    expect(body.text.format).toEqual({
      type: "json_schema",
      name: "tutor_response",
      strict: true,
      schema: request.responseJsonSchema,
    });
  });

  it("fails when the server-side key is absent", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    await expect(new OpenAIProvider().generate(request)).rejects.toThrow("OPENAI_API_KEY is not configured");
    expect(mocks.fetch).not.toHaveBeenCalled();
  });

  it("does not expose provider response bodies in errors", async () => {
    mocks.fetch.mockResolvedValue(new Response("private request details", { status: 429 }));
    await expect(new OpenAIProvider().generate(request)).rejects.toThrow("OpenAI API error (HTTP 429)");
    await expect(new OpenAIProvider().generate(request)).rejects.not.toThrow("private request details");
  });

  it("rejects malformed structured output", async () => {
    mocks.fetch.mockResolvedValue(Response.json({
      output: [{ type: "message", content: [{ type: "output_text", text: "not-json" }] }],
    }));
    await expect(new OpenAIProvider().generateStructured(request)).rejects.toThrow(LLMProviderError);
  });
});
