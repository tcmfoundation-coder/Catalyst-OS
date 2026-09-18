import { z, type ZodType } from "zod";
import { LLMProviderError, type LLMGenerationRequest, type LLMProvider } from "./llm-provider";

/**
 * The reusable "LLM output -> parse -> validate -> typed object" pipeline
 * every structured AI feature (quiz, flashcards, study plan, ...) will
 * build on. This is the ONLY place model output is allowed to become a
 * typed application value — invalid or malformed output is always
 * rejected here, never passed through and never written anywhere.
 */

export type StructuredOutcome<T> =
  | { ok: true; data: T; model: string; usage: { inputTokens: number; outputTokens: number } }
  | { ok: false; error: string; raw?: unknown };

/**
 * `schema` must describe a JSON object at its root (see
 * llm-provider.ts's responseJsonSchema comment) — that's what lets it
 * become an Anthropic tool input_schema. Never throws: every failure mode
 * (provider error, non-object output, schema mismatch) comes back as
 * `{ ok: false, error }` so a caller can't accidentally let bad output
 * through by forgetting a try/catch.
 */
export async function generateStructuredOutput<T>(
  provider: LLMProvider,
  request: LLMGenerationRequest,
  schema: ZodType<T>,
  schemaName = "structured_output",
): Promise<StructuredOutcome<T>> {
  const jsonSchema = z.toJSONSchema(schema) as { type: "object"; [key: string]: unknown };
  if (jsonSchema.type !== "object") {
    return { ok: false, error: "Structured output schema must describe a JSON object at its root" };
  }

  let result;
  try {
    result = await provider.generateStructured({
      ...request,
      responseSchemaName: schemaName,
      responseJsonSchema: jsonSchema,
    });
  } catch (error) {
    return { ok: false, error: error instanceof LLMProviderError ? error.message : "LLM generation failed" };
  }

  const parsed = schema.safeParse(result.structuredOutput);
  if (!parsed.success) {
    return { ok: false, error: "Model output did not match the expected schema", raw: result.structuredOutput };
  }

  return { ok: true, data: parsed.data, model: result.model, usage: result.usage };
}
