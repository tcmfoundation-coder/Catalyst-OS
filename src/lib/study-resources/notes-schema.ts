import { z } from "zod";

/**
 * Every size limit a Study Notes generation can produce, in one place —
 * same "single policy file" convention as lib/tutor/conversation-policy.ts
 * and lib/ai/constants.ts's RETRIEVAL_POLICY. These aren't just guidance
 * for the model: they're enforced structurally by the Zod schema below via
 * `.max()`, so a model response that ignores them fails validation and is
 * never persisted — there's no path from "the model produced 40 sections"
 * to "a 40-section document lands in MongoDB."
 */
export const NOTES_LIMITS = {
  maxSections: 10,
  maxKeyPointsPerSection: 8,
  maxDefinitionsPerSection: 8,
  maxExamplesPerSection: 5,
  maxTitleLength: 150,
  maxOverviewLength: 800,
  maxHeadingLength: 150,
  maxSummaryLength: 800,
  maxKeyPointLength: 300,
  maxTermLength: 150,
  maxDefinitionLength: 400,
  maxExampleLength: 400,
} as const;

const trimmedString = (max: number) => z.string().trim().min(1).max(max);

const NoteDefinitionSchema = z.object({
  term: trimmedString(NOTES_LIMITS.maxTermLength),
  definition: trimmedString(NOTES_LIMITS.maxDefinitionLength),
});
export type NoteDefinition = z.infer<typeof NoteDefinitionSchema>;

const NoteSectionSchema = z.object({
  heading: trimmedString(NOTES_LIMITS.maxHeadingLength),
  summary: trimmedString(NOTES_LIMITS.maxSummaryLength),
  // Empty arrays are valid — not every section has definitions or
  // examples worth calling out — but each individual item, once present,
  // must be non-empty and within budget.
  keyPoints: z.array(trimmedString(NOTES_LIMITS.maxKeyPointLength)).max(NOTES_LIMITS.maxKeyPointsPerSection).default([]),
  definitions: z.array(NoteDefinitionSchema).max(NOTES_LIMITS.maxDefinitionsPerSection).default([]),
  examples: z.array(trimmedString(NOTES_LIMITS.maxExampleLength)).max(NOTES_LIMITS.maxExamplesPerSection).default([]),
});
export type NoteSection = z.infer<typeof NoteSectionSchema>;

/**
 * What the model itself is asked to produce. No `sources` field exists
 * here on purpose — see notes-instructions.ts and study-resources/service.ts:
 * sources are always attached afterward from ContextAssembler's own
 * retrieval output, so the model has no field to manufacture a citation
 * into even if it tried. A response with zero sections isn't "notes," so
 * `.min(1)` makes that a validation failure rather than an empty resource
 * silently getting persisted.
 */
export const StudyNotesModelOutputSchema = z.object({
  title: trimmedString(NOTES_LIMITS.maxTitleLength),
  overview: trimmedString(NOTES_LIMITS.maxOverviewLength),
  sections: z.array(NoteSectionSchema).min(1).max(NOTES_LIMITS.maxSections),
});
export type StudyNotesModelOutput = z.infer<typeof StudyNotesModelOutputSchema>;
