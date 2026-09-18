import { describe, expect, it } from "vitest";
import { LearningMemoryInputSchema } from "./validation";

function validInput(overrides: Partial<Record<string, string>> = {}) {
  return {
    content: "I finally understood recursion today.",
    category: "insight",
    courseId: "",
    ...overrides,
  };
}

describe("LearningMemoryInputSchema", () => {
  it("accepts a minimal valid memory", () => {
    expect(LearningMemoryInputSchema.safeParse(validInput()).success).toBe(true);
  });

  it("rejects content that's too short", () => {
    expect(LearningMemoryInputSchema.safeParse(validInput({ content: "a" })).success).toBe(false);
  });

  it("rejects content over the length limit", () => {
    const tooLong = "a".repeat(2001);
    expect(LearningMemoryInputSchema.safeParse(validInput({ content: tooLong })).success).toBe(
      false,
    );
  });

  it("accepts every defined category", () => {
    for (const category of ["insight", "difficulty", "preference", "reminder", "general"]) {
      expect(LearningMemoryInputSchema.safeParse(validInput({ category })).success).toBe(true);
    }
  });

  it("rejects an unrecognized category", () => {
    expect(LearningMemoryInputSchema.safeParse(validInput({ category: "breakthrough" })).success).toBe(
      false,
    );
  });
});
