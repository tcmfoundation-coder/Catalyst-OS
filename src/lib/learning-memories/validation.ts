import { z } from "zod";
import { MEMORY_CATEGORIES } from "./constants";

// Fields are plain strings (never null/undefined), matching how they're read
// off FormData — see lib/actions/learning-memories.ts's readMemoryInput().
export const LearningMemoryInputSchema = z.object({
  content: z.string().trim().min(2, "Write a bit more").max(2000, "That's too long"),
  category: z.enum(MEMORY_CATEGORIES, { error: "Select a valid category" }),
  courseId: z.string(),
});

export type LearningMemoryInput = z.infer<typeof LearningMemoryInputSchema>;
