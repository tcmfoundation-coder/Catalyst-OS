import { describe, expect, it } from "vitest";
import { parseProcessorOutput } from "./processor-result";

function validChunk() {
  return {
    chunkIndex: 0,
    text: "Some extracted text",
    heading: "Chapter One",
    pageStart: 1,
    pageEnd: 1,
    slideStart: null,
    slideEnd: null,
  };
}

function validMetadata() {
  return {
    title: "My Document",
    author: null,
    pageCount: 3,
    slideCount: null,
    sourceFormat: "pdf",
    requiresOcr: false,
  };
}

describe("parseProcessorOutput", () => {
  it("accepts a well-formed success result", () => {
    const result = parseProcessorOutput(
      JSON.stringify({ ok: true, requiresOcr: false, metadata: validMetadata(), chunks: [validChunk()] }),
    );
    expect(result.ok).toBe(true);
  });

  it("accepts a well-formed failure result", () => {
    const result = parseProcessorOutput(JSON.stringify({ ok: false, error: "Could not read PDF" }));
    expect(result).toEqual({ ok: false, error: "Could not read PDF" });
  });

  it("degrades to a clean failure on invalid JSON rather than throwing", () => {
    const result = parseProcessorOutput("not json at all {{{");
    expect(result.ok).toBe(false);
  });

  it("degrades to a clean failure when the shape doesn't match, e.g. an unknown sourceFormat", () => {
    const result = parseProcessorOutput(
      JSON.stringify({
        ok: true,
        requiresOcr: false,
        metadata: { ...validMetadata(), sourceFormat: "exe" },
        chunks: [],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("degrades to a clean failure when a chunk is missing required fields", () => {
    const result = parseProcessorOutput(
      JSON.stringify({
        ok: true,
        requiresOcr: false,
        metadata: validMetadata(),
        chunks: [{ chunkIndex: 0 }],
      }),
    );
    expect(result.ok).toBe(false);
  });

  it("handles trailing whitespace/newlines around the JSON", () => {
    const result = parseProcessorOutput(`\n${JSON.stringify({ ok: false, error: "x" })}\n`);
    expect(result).toEqual({ ok: false, error: "x" });
  });
});
