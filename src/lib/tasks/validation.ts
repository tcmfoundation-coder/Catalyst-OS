import { z } from "zod";
import { TASK_TYPES, TASK_PRIORITIES, TASK_STATUSES } from "./constants";

// Fields are plain strings (never null/undefined) with "" meaning "empty" for
// the optional ones, matching how they're read off FormData — see
// lib/actions/tasks.ts's readTaskInput().
export const TaskInputSchema = z.object({
  title: z.string().trim().min(2, "Title must be at least 2 characters").max(200),
  description: z.string().trim().max(2000, "Description is too long"),
  type: z.enum(TASK_TYPES, { error: "Select a valid task type" }),
  priority: z.enum(TASK_PRIORITIES, { error: "Select a valid priority" }),
  dueDate: z
    .string()
    .refine((value) => value === "" || !Number.isNaN(Date.parse(value)), {
      error: "Enter a valid due date",
    }),
  courseId: z.string(),
});

export type TaskInput = z.infer<typeof TaskInputSchema>;

export const TaskStatusInputSchema = z.object({
  status: z.enum(TASK_STATUSES, { error: "Select a valid status" }),
});
