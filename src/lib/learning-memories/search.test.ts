import { describe, expect, it } from "vitest";
import { escapeRegExp } from "./search";

describe("escapeRegExp", () => {
  it("leaves plain text unchanged", () => {
    expect(escapeRegExp("recursion")).toBe("recursion");
  });

  it("escapes regex metacharacters", () => {
    expect(escapeRegExp("a.b*c+d?e")).toBe("a\\.b\\*c\\+d\\?e");
  });

  it("produces a pattern that matches only the literal string", () => {
    const escaped = escapeRegExp("3.14 (pi)");
    const pattern = new RegExp(escaped);
    expect(pattern.test("3.14 (pi)")).toBe(true);
    expect(pattern.test("3x14 (pi)")).toBe(false);
  });

  it("neutralizes a pathological-looking pattern instead of executing it as regex", () => {
    const input = "(a+)+$";
    const escaped = escapeRegExp(input);
    expect(new RegExp(escaped).test(input)).toBe(true);
    expect(escaped).not.toBe(input);
  });
});
