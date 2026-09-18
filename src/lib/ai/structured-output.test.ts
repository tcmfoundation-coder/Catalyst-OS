import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  LLMProviderError,
  type LLMGenerationRequest,
  type LLMProvider,
  type StructuredLLMGenerationResult,
} from "./llm-provider";
import { generateStructuredOutput } from "./structured-output";

const QuizSchema = z.object({
  question: z.string(),
  choices: z.array(z.string()).length(4),
  correctIndex: z.number().int().min(0).max(3),
});

class FakeLLMProvider implements LLMProvider {
  constructor(
    private readonly structuredOutput: unknown,
    private readonly shouldThrow: Error | null = null,
  ) {}

  async generate(): Promise<never> {
    throw new Error("not used in these tests");
  }

  async generateStructured(): Promise<StructuredLLMGenerationResult> {
    if (this.shouldThrow) throw this.shouldThrow;
    return {
      text: JSON.stringify(this.structuredOutput),
      structuredOutput: this.structuredOutput,
      model: "fake-model",
      stopReason: "end_turn",
      usage: { inputTokens: 10, outputTokens: 5 },
    };
  }
}

const baseRequest: LLMGenerationRequest = { systemInstructions: "sys", userInput: "user" };

describe("generateStructuredOutput", () => {
  it("accepts valid model output and returns a typed result", async () => {
    const provider = new FakeLLMProvider({ question: "2+2?", choices: ["1", "2", "3", "4"], correctIndex: 3 });
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);

    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.data.correctIndex).toBe(3);
      expect(outcome.model).toBe("fake-model");
    }
  });

  it("rejects output missing a required field", async () => {
    const provider = new FakeLLMProvider({ question: "2+2?", choices: ["1", "2", "3", "4"] });
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/did not match/);
    }
  });

  it("rejects output with the wrong shape (e.g. wrong array length)", async () => {
    const provider = new FakeLLMProvider({ question: "2+2?", choices: ["1", "2"], correctIndex: 0 });
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);
    expect(outcome.ok).toBe(false);
  });

  it("rejects output that is not an object at all (e.g. a bare string)", async () => {
    const provider = new FakeLLMProvider("not an object");
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);
    expect(outcome.ok).toBe(false);
  });

  it("handles a provider throwing (malformed JSON, network failure, etc.) safely without throwing itself", async () => {
    const provider = new FakeLLMProvider(null, new LLMProviderError("Anthropic response contained no structured tool_use output"));
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);

    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.error).toMatch(/tool_use/);
    }
  });

  it("handles an unexpected non-LLMProviderError throw safely too", async () => {
    const provider = new FakeLLMProvider(null, new Error("boom"));
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);
    expect(outcome.ok).toBe(false);
  });

  it("never returns ok:true for invalid data, even partially valid data", async () => {
    const provider = new FakeLLMProvider({ question: "2+2?", choices: ["1", "2", "3", "4"], correctIndex: 99 });
    const outcome = await generateStructuredOutput(provider, baseRequest, QuizSchema);
    expect(outcome.ok).toBe(false);
  });
});
