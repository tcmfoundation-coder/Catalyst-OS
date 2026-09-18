import { z } from "zod";
import type { AskFailure, StructuredAskResult } from "./orchestrator";

/**
 * The generic request shape for generateStructuredResource() — deliberately
 * not "a question" (see resource-generation.ts's docstring): a resource
 * generator covers a material, it doesn't answer a semantic query, so
 * there's no query text here, just which material/course and a fixed,
 * developer-authored instruction describing what to generate.
 */
export const ResourceGenerationRequestSchema = z.object({
  materialId: z.string().min(1, "materialId is required"),
  courseId: z.string().optional(),
  instruction: z.string().trim().min(1).max(500),
});
export type ResourceGenerationRequest = z.infer<typeof ResourceGenerationRequestSchema>;

/**
 * Same result shape askStructured() already returns — sources/retrievalStatus
 * always from ContextAssembler, `data` schema-validated — aliased under a
 * resource-generation name so a caller of resource-generation.ts never
 * needs to know it happens to reuse orchestrator.ts's types underneath.
 */
export type ResourceGenerationFailure = AskFailure;
export type ResourceGenerationResult<T> = StructuredAskResult<T>;
