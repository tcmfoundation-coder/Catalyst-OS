/**
 * The app-level LLM seam. AIOrchestrator, and nothing else, depends on
 * this interface — never on an SDK directly. AnthropicProvider is the
 * only implementation today; a future ExternalLLMProvider/local-model
 * provider can be added without touching the orchestrator, ContextAssembler,
 * or PromptBuilder, exactly like EmbeddingProvider in lib/embeddings.
 */

export interface LLMGenerationRequest {
  /** Fixed, application-authored instructions — see prompt-builder.ts. Never derived from user or document content. */
  systemInstructions: string;
  /** The fully-composed user turn (question + delimited context sections) built by PromptBuilder. */
  userInput: string;
  model?: string;
  /** Generation control where the provider supports it — see anthropic-provider.ts's docstring for a real constraint discovered on the current default model. */
  temperature?: number;
  maxOutputTokens?: number;
}

export interface StructuredLLMGenerationRequest extends LLMGenerationRequest {
  /** Name of the structured output "shape" being requested (surfaced to the model, e.g. via a forced tool call). */
  responseSchemaName: string;
  /**
   * A JSON Schema (e.g. from zod's z.toJSONSchema) describing the required
   * output shape. Always object-rooted: a "typed application object" is
   * always a JSON object, never a bare string/array/primitive.
   */
  responseJsonSchema: { type: "object"; [key: string]: unknown };
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMGenerationResult {
  text: string;
  model: string;
  stopReason: string;
  usage: LLMUsage;
}

export interface StructuredLLMGenerationResult extends LLMGenerationResult {
  /** Parsed JSON from the model, NOT yet validated against a zod schema — see structured-output.ts for that step. */
  structuredOutput: unknown;
}

/** Wraps every provider-boundary failure (network, auth, rate limit, missing config, unexpected response shape) in one type callers can catch without knowing which SDK is underneath. */
export class LLMProviderError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "LLMProviderError";
  }
}

export interface LLMProvider {
  generate(request: LLMGenerationRequest): Promise<LLMGenerationResult>;
  generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult>;
}
