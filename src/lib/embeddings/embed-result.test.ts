import { describe, expect, it } from "vitest";
import { parseEmbedOutput } from "./embed-result";

describe("parseEmbedOutput", () => {
  it("accepts a well-formed success result", () => {
    const result = parseEmbedOutput(
      JSON.stringify({ ok: true, model: "BAAI/bge-small-en-v1.5", dimension: 3, embeddings: [[0.1, 0.2, 0.3]] }),
    );
    expect(result).toEqual({ ok: true, model: "BAAI/bge-small-en-v1.5", dimension: 3, embeddings: [[0.1, 0.2, 0.3]] });
  });

  it("accepts a well-formed failure result", () => {
    const result = parseEmbedOutput(JSON.stringify({ ok: false, error: "model unavailable" }));
    expect(result).toEqual({ ok: false, error: "model unavailable" });
  });

  it("degrades to a clean failure on invalid JSON rather than throwing", () => {
    const result = parseEmbedOutput("not json at all {{{");
    expect(result.ok).toBe(false);
  });

  it("degrades to a clean failure when embeddings is missing", () => {
    const result = parseEmbedOutput(JSON.stringify({ ok: true, model: "x", dimension: 3 }));
    expect(result.ok).toBe(false);
  });

  it("degrades to a clean failure when embeddings is an empty array", () => {
    const result = parseEmbedOutput(JSON.stringify({ ok: true, model: "x", dimension: 3, embeddings: [] }));
    expect(result.ok).toBe(false);
  });

  it("degrades to a clean failure when dimension is not a positive integer", () => {
    const result = parseEmbedOutput(JSON.stringify({ ok: true, model: "x", dimension: 0, embeddings: [[1]] }));
    expect(result.ok).toBe(false);
  });

  it("handles trailing whitespace/newlines around the JSON", () => {
    const result = parseEmbedOutput(`\n${JSON.stringify({ ok: false, error: "x" })}\n`);
    expect(result).toEqual({ ok: false, error: "x" });
  });
});
