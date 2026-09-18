import { z } from "zod";

/**
 * Same reasoning as study-materials/processor-result.ts: the embedding
 * CLI's stdout is a cross-process, cross-language trust boundary, so its
 * shape is checked at runtime rather than just cast.
 */

const EmbedSuccessSchema = z.object({
  ok: z.literal(true),
  model: z.string().min(1),
  dimension: z.number().int().positive(),
  embeddings: z.array(z.array(z.number())).min(1),
});

const EmbedFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export const EmbedResultSchema = z.discriminatedUnion("ok", [EmbedSuccessSchema, EmbedFailureSchema]);

export type EmbedResult = z.infer<typeof EmbedResultSchema>;

/** Parses and validates the embedding CLI's stdout, never throwing. */
export function parseEmbedOutput(stdout: string): EmbedResult {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.trim());
  } catch {
    return { ok: false, error: "Embedding process produced invalid JSON output" };
  }

  const parsed = EmbedResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Embedding process output did not match the expected shape" };
  }
  return parsed.data;
}
