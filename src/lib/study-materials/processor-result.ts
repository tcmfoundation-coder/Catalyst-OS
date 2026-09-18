import { z } from "zod";
import { MATERIAL_FORMATS } from "./constants";

/**
 * The Python processor's stdout is a cross-process, cross-language trust
 * boundary — it's still "our" code, but a bug there (or someone tampering
 * with it) shouldn't be able to hand Next.js a malformed object and have
 * it silently coerced into whatever TypeScript's type system hoped for.
 * This schema is the actual runtime check at that boundary.
 */

const ChunkSchema = z.object({
  chunkIndex: z.number().int().min(0),
  text: z.string().min(1),
  heading: z.string().nullable(),
  pageStart: z.number().int().nullable(),
  pageEnd: z.number().int().nullable(),
  slideStart: z.number().int().nullable(),
  slideEnd: z.number().int().nullable(),
});

const MetadataSchema = z.object({
  title: z.string().nullable(),
  author: z.string().nullable(),
  pageCount: z.number().int().nullable(),
  slideCount: z.number().int().nullable(),
  sourceFormat: z.enum(MATERIAL_FORMATS),
  requiresOcr: z.boolean(),
});

const ProcessorSuccessSchema = z.object({
  ok: z.literal(true),
  requiresOcr: z.boolean(),
  metadata: MetadataSchema,
  chunks: z.array(ChunkSchema),
});

const ProcessorFailureSchema = z.object({
  ok: z.literal(false),
  error: z.string(),
});

export const ProcessorResultSchema = z.discriminatedUnion("ok", [
  ProcessorSuccessSchema,
  ProcessorFailureSchema,
]);

export type ProcessorChunk = z.infer<typeof ChunkSchema>;
export type ProcessorResult = z.infer<typeof ProcessorResultSchema>;

/** Parses and validates the processor's stdout, never throwing — a bad boundary should degrade to a clean failure, not an unhandled exception. */
export function parseProcessorOutput(stdout: string): ProcessorResult {
  let raw: unknown;
  try {
    raw = JSON.parse(stdout.trim());
  } catch {
    return { ok: false, error: "Processor produced invalid JSON output" };
  }

  const parsed = ProcessorResultSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: "Processor output did not match the expected shape" };
  }
  return parsed.data;
}
