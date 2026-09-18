import { z } from "zod";

function isTodayOrEarlier(value: string): boolean {
  const parsed = new Date(value);
  const today = new Date();
  const todayKey = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const parsedKey = Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate());
  return parsedKey <= todayKey;
}

// Fields are plain strings (never null/undefined), matching how they're read
// off FormData — see lib/actions/study-sessions.ts's readSessionInput().
export const StudySessionInputSchema = z.object({
  date: z
    .string()
    .refine((value) => !Number.isNaN(Date.parse(value)), { error: "Enter a valid date" })
    .refine(isTodayOrEarlier, { error: "Date can't be in the future" }),
  durationMinutes: z.coerce
    .number()
    .int("Duration must be a whole number of minutes")
    .min(1, "Duration must be at least 1 minute")
    .max(1440, "Duration can't exceed 24 hours"),
  courseId: z.string(),
  notes: z.string().trim().max(1000, "Notes are too long"),
});

export type StudySessionInput = z.infer<typeof StudySessionInputSchema>;
