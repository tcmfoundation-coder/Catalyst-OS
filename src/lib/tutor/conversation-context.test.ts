import { describe, expect, it } from "vitest";
import { boundConversationHistory, type ConversationMessageLike } from "./conversation-context";

function msg(role: "user" | "assistant", content: string): ConversationMessageLike {
  return { role, content };
}

describe("boundConversationHistory", () => {
  it("returns everything when under both limits", () => {
    const messages = [msg("user", "What is RAM?"), msg("assistant", "RAM is volatile memory.")];
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 6, maxHistoryCharacters: 2000 });
    expect(bounded).toEqual(messages);
  });

  it("keeps only the most recent maxHistoryMessages, dropping the oldest first", () => {
    const messages = [
      msg("user", "Q1"),
      msg("assistant", "A1"),
      msg("user", "Q2"),
      msg("assistant", "A2"),
      msg("user", "Q3"),
      msg("assistant", "A3"),
      msg("user", "Q4"),
      msg("assistant", "A4"),
    ];
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 4, maxHistoryCharacters: 2000 });
    expect(bounded.map((m) => m.content)).toEqual(["Q3", "A3", "Q4", "A4"]);
  });

  it("preserves chronological order (oldest of the kept messages first)", () => {
    const messages = [msg("user", "Q1"), msg("assistant", "A1"), msg("user", "Q2")];
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 6, maxHistoryCharacters: 2000 });
    expect(bounded.map((m) => m.content)).toEqual(["Q1", "A1", "Q2"]);
  });

  it("trims further by character budget, keeping the newest messages", () => {
    const messages = [msg("user", "a".repeat(500)), msg("assistant", "b".repeat(500)), msg("user", "c".repeat(500))];
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 6, maxHistoryCharacters: 900 });
    // Newest ("c") always kept; "b" fits within budget (500+500=1000 > 900
    // actually doesn't fit either — only the single newest one fits).
    expect(bounded.map((m) => m.role)).toEqual(["user"]);
    expect(bounded[0].content).toBe("c".repeat(500));
  });

  it("always keeps at least one message even if it alone exceeds the character budget", () => {
    const messages = [msg("user", "x".repeat(5000))];
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 6, maxHistoryCharacters: 100 });
    expect(bounded).toHaveLength(1);
  });

  it("returns an empty array for no history", () => {
    expect(boundConversationHistory([], { maxHistoryMessages: 6, maxHistoryCharacters: 2000 })).toEqual([]);
  });

  it("uses the default policy when none is given", () => {
    const messages = [msg("user", "What is RAM?")];
    const bounded = boundConversationHistory(messages);
    expect(bounded).toEqual(messages);
  });

  it("never includes more than maxHistoryMessages even when characters would allow it", () => {
    const messages = Array.from({ length: 10 }, (_, i) => msg(i % 2 === 0 ? "user" : "assistant", `msg${i}`));
    const bounded = boundConversationHistory(messages, { maxHistoryMessages: 3, maxHistoryCharacters: 100000 });
    expect(bounded).toHaveLength(3);
    expect(bounded.map((m) => m.content)).toEqual(["msg7", "msg8", "msg9"]);
  });
});
