export const MEMORY_CATEGORIES = ["insight", "difficulty", "preference", "reminder", "general"] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORIES)[number];

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  insight: "Insight",
  difficulty: "Difficulty",
  preference: "Preference",
  reminder: "Reminder",
  general: "General",
};
