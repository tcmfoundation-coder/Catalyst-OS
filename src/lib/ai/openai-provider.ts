import "server-only";
import { DEFAULT_MAX_OUTPUT_TOKENS, DEFAULT_OPENAI_MODEL } from "./constants";
import {
  LLMProviderError,
  type LLMGenerationRequest,
  type LLMGenerationResult,
  type LLMProvider,
  type StructuredLLMGenerationRequest,
  type StructuredLLMGenerationResult,
} from "./llm-provider";

const REASONING_EFFORTS = ["minimal", "low", "medium", "high"] as const;
type ReasoningEffort = (typeof REASONING_EFFORTS)[number];

type ResponsesResult = {
  id?: string;
  model?: string;
  status?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  usage?: { input_tokens?: number; output_tokens?: number };
};

function getModel(): string {
  return process.env.OPENAI_MODEL?.trim() || process.env.LLM_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
}

function getReasoningEffort(): ReasoningEffort {
  const effort = process.env.OPENAI_REASONING_EFFORT?.trim() || "medium";
  if ((REASONING_EFFORTS as readonly string[]).includes(effort)) return effort as ReasoningEffort;
  throw new LLMProviderError("Invalid OPENAI_REASONING_EFFORT. Use minimal, low, medium, or high.");
}

function getApiKey(): string {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new LLMProviderError("OPENAI_API_KEY is not configured");
  return apiKey;
}

function extractText(response: ResponsesResult): string {
  const text = response.output
    ?.filter((item) => item.type === "message")
    .flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("");
  if (!text?.trim()) throw new LLMProviderError("OpenAI returned no text content");
  return text;
}

async function createResponse(request: LLMGenerationRequest, textFormat?: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    model: request.model ?? getModel(),
    instructions: request.systemInstructions,
    input: request.userInput,
    max_output_tokens: request.maxOutputTokens ?? DEFAULT_MAX_OUTPUT_TOKENS,
    reasoning: { effort: getReasoningEffort() },
  };

  if (request.temperature !== undefined) body.temperature = request.temperature;
  if (textFormat) body.text = { format: textFormat };

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new LLMProviderError(`OpenAI API error (HTTP ${response.status})`);
  }
  return (await response.json()) as ResponsesResult;
}

function resultMetadata(response: ResponsesResult, requestedModel: string) {
  return {
    model: response.model ?? requestedModel,
    stopReason: response.status ?? "unknown",
    usage: {
      inputTokens: response.usage?.input_tokens ?? 0,
      outputTokens: response.usage?.output_tokens ?? 0,
    },
  };
}

function describeError(error: unknown): string {
  if (error instanceof LLMProviderError) return error.message;
  return "OpenAI request failed. Check the server logs and provider configuration.";
}

export class OpenAIProvider implements LLMProvider {
  async generate(request: LLMGenerationRequest): Promise<LLMGenerationResult> {
    try {
      const model = request.model ?? getModel();
      const response = await createResponse(request);
      return { text: extractText(response), ...resultMetadata(response, model) };
    } catch (error) {
      throw new LLMProviderError(describeError(error), error);
    }
  }

  async generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult> {
    try {
      const model = request.model ?? getModel();
      const response = await createResponse(request, {
        type: "json_schema",
        name: request.responseSchemaName,
        strict: true,
        schema: request.responseJsonSchema,
      });
      const text = extractText(response);
      let structuredOutput: unknown;
      try {
        structuredOutput = JSON.parse(text);
      } catch (error) {
        throw new LLMProviderError("OpenAI returned invalid JSON for a structured response", error);
      }
      return { text, structuredOutput, ...resultMetadata(response, model) };
    } catch (error) {
      throw new LLMProviderError(describeError(error), error);
    }
  }
}
