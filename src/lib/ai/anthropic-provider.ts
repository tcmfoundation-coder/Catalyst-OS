import "server-only";
import Anthropic, { APIError } from "@anthropic-ai/sdk";
import { DEFAULT_LLM_MODEL, DEFAULT_MAX_OUTPUT_TOKENS } from "./constants";
import {
  LLMProviderError,
  type LLMGenerationRequest,
  type LLMGenerationResult,
  type LLMProvider,
  type StructuredLLMGenerationRequest,
  type StructuredLLMGenerationResult,
} from "./llm-provider";

/**
 * The only file allowed to import @anthropic-ai/sdk. Structured output
 * uses Anthropic's forced tool-use technique (a synthetic tool whose
 * input_schema is the caller's JSON Schema, with tool_choice forced to
 * it) rather than asking the model to "output JSON" in prose — this is
 * the documented, reliable way to get schema-shaped output from Claude,
 * versus hoping the model doesn't wrap it in code fences or commentary.
 *
 * Note on `temperature`: the installed SDK's own type comment says models
 * released after Claude Opus 4.6 (including the current default model)
 * reject any value other than 1.0 with a 400 error. Rather than silently
 * dropping a caller's request or letting it 400, this provider only
 * forwards `temperature` when it's exactly 1 and omits the field
 * otherwise, so "temperature support" degrades to "the model's own
 * default," not a broken request.
 */

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new LLMProviderError("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

function describeError(error: unknown): string {
  if (error instanceof APIError) {
    return `Anthropic API error (status ${error.status ?? "unknown"}): ${error.message}`;
  }
  return error instanceof Error ? error.message : "Unknown error calling Anthropic";
}

function temperatureParam(temperature: number | undefined): { temperature: number } | Record<string, never> {
  return temperature === 1 ? { temperature: 1 } : {};
}

function extractUsage(usage: { input_tokens: number; output_tokens: number }) {
  return { inputTokens: usage.input_tokens, outputTokens: usage.output_tokens };
}

export class AnthropicProvider implements LLMProvider {
  async generate(request: LLMGenerationRequest): Promise<LLMGenerationResult> {
    const client = getClient();
    try {
      const response = await client.messages.create({
        model: request.model ?? DEFAULT_LLM_MODEL,
        max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        system: request.systemInstructions,
        messages: [{ role: "user", content: request.userInput }],
        ...temperatureParam(request.temperature),
      });

      const textBlock = response.content.find((block): block is Anthropic.TextBlock => block.type === "text");
      if (!textBlock) {
        throw new LLMProviderError("Anthropic response contained no text content");
      }

      return {
        text: textBlock.text,
        model: response.model,
        stopReason: response.stop_reason ?? "unknown",
        usage: extractUsage(response.usage),
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(describeError(error), error);
    }
  }

  async generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult> {
    const client = getClient();
    try {
      const response = await client.messages.create({
        model: request.model ?? DEFAULT_LLM_MODEL,
        max_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
        system: request.systemInstructions,
        messages: [{ role: "user", content: request.userInput }],
        tools: [
          {
            name: request.responseSchemaName,
            description: `Return the result as ${request.responseSchemaName}, matching the provided schema exactly.`,
            input_schema: request.responseJsonSchema,
          },
        ],
        tool_choice: { type: "tool", name: request.responseSchemaName },
        ...temperatureParam(request.temperature),
      });

      const toolBlock = response.content.find((block): block is Anthropic.ToolUseBlock => block.type === "tool_use");
      if (!toolBlock) {
        throw new LLMProviderError("Anthropic response contained no structured tool_use output");
      }

      return {
        text: JSON.stringify(toolBlock.input),
        structuredOutput: toolBlock.input,
        model: response.model,
        stopReason: response.stop_reason ?? "unknown",
        usage: extractUsage(response.usage),
      };
    } catch (error) {
      if (error instanceof LLMProviderError) throw error;
      throw new LLMProviderError(describeError(error), error);
    }
  }
}

let defaultProvider: LLMProvider | null = null;

/** Factory seam: swap the implementation here to add another provider later. */
export function getLLMProvider(): LLMProvider {
  if (!defaultProvider) {
    defaultProvider = new AnthropicProvider();
  }
  return defaultProvider;
}
