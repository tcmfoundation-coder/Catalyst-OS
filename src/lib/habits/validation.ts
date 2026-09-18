import { z } from "zod";

export const HabitInputSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").max(100),
  description: z.string().trim().max(500, "Description is too long"),
});

export type HabitInput = z.infer<typeof HabitInputSchema>;
