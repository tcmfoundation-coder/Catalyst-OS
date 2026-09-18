import { describe, expect, it } from "vitest";
import { deriveConversationTitle } from "./conversation-title";

describe("deriveConversationTitle", () => {
  it("uses the question as-is when short, stripping trailing punctuation", () => {
    expect(deriveConversationTitle("What is RAM?")).toBe("What is RAM");
  });

  it("collapses internal whitespace", () => {
    expect(deriveConversationTitle("What   is\n\nRAM?")).toBe("What is RAM");
  });

  it("trims leading/trailing whitespace", () => {
    expect(deriveConversationTitle("   What is RAM?   ")).toBe("What is RAM");
  });

  it("strips multiple trailing punctuation marks", () => {
    expect(deriveConversationTitle("Is this real?!")).toBe("Is this real");
  });

  it("truncates a long question with an ellipsis, respecting the max length", () => {
    const long = "Explain in great detail how volatile memory differs from non-volatile storage in modern computer architectures";
    const title = deriveConversationTitle(long);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith("…")).toBe(true);
    expect(long.startsWith(title.slice(0, -1))).toBe(true);
  });

  it("falls back to a generic title for an empty/whitespace-only question", () => {
    expect(deriveConversationTitle("   ")).toBe("New conversation");
    expect(deriveConversationTitle("")).toBe("New conversation");
  });

  it("is deterministic — the same input always produces the same title", () => {
    const question = "What is the difference between RAM and ROM?";
    expect(deriveConversationTitle(question)).toBe(deriveConversationTitle(question));
  });

  it("does not truncate a question exactly at the length boundary", () => {
    const exact = "a".repeat(60);
    expect(deriveConversationTitle(exact)).toBe(exact);
    expect(deriveConversationTitle(exact).length).toBe(60);
  });
});
