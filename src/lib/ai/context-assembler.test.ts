import { describe, expect, it } from "vitest";
import type { RetrievalHit } from "@/lib/retrieval/types";
import { build } from "./context-assembler";

function hit(overrides: Partial<RetrievalHit["chunk"]> & { score: number; page?: number | null; slide?: number | null; heading?: string | null }): RetrievalHit {
  const id = overrides.id ?? `chunk-${overrides.score}`;
  return {
    score: overrides.score,
    chunk: {
      id,
      materialId: overrides.materialId ?? "material-1",
      courseId: overrides.courseId ?? null,
      chunkIndex: overrides.chunkIndex ?? 0,
      text: overrides.text ?? "Some chunk text",
      heading: overrides.heading ?? null,
      pageStart: overrides.pageStart ?? null,
      pageEnd: overrides.pageEnd ?? null,
      slideStart: overrides.slideStart ?? null,
      slideEnd: overrides.slideEnd ?? null,
    },
    source: {
      materialId: overrides.materialId ?? "material-1",
      page: overrides.page ?? null,
      slide: overrides.slide ?? null,
      heading: overrides.heading ?? null,
    },
  };
}

describe("ContextAssembler.build", () => {
  it("orders sources by descending score regardless of input order", () => {
    const context = build({
      question: "q",
      hits: [hit({ id: "a", score: 0.4 }), hit({ id: "b", score: 0.9 }), hit({ id: "c", score: 0.6 })],
    });
    expect(context.sources.map((s) => s.chunkId)).toEqual(["b", "c", "a"]);
  });

  it("applies the similarity threshold, dropping hits below it", () => {
    const context = build({
      question: "q",
      hits: [hit({ id: "high", score: 0.8 }), hit({ id: "low", score: 0.1 })],
      minimumSimilarity: 0.3,
    });
    expect(context.sources.map((s) => s.chunkId)).toEqual(["high"]);
  });

  it("limits to maxContextChunks even when more relevant hits exist", () => {
    const hits = Array.from({ length: 10 }, (_, i) => hit({ id: `c${i}`, score: 1 - i * 0.01 }));
    const context = build({ question: "q", hits, maxContextChunks: 3 });
    expect(context.sources).toHaveLength(3);
    expect(context.sources.map((s) => s.chunkId)).toEqual(["c0", "c1", "c2"]);
  });

  it("limits total context by character budget, always keeping at least one source", () => {
    const bigText = "x".repeat(5000);
    const hits = [
      hit({ id: "first", score: 0.9, text: bigText }),
      hit({ id: "second", score: 0.8, text: bigText }),
    ];
    const context = build({ question: "q", hits, maxContextCharacters: 6000, maxContextChunks: 10 });
    // The first (highest-scoring) chunk alone already exceeds a smaller
    // remaining budget, but is still included; the second must not be,
    // since 5000 + 5000 > 6000.
    expect(context.sources.map((s) => s.chunkId)).toEqual(["first"]);
  });

  it("preserves page/slide/heading/materialId/courseId/score metadata", () => {
    const context = build({
      question: "q",
      hits: [
        hit({
          id: "a",
          score: 0.77,
          materialId: "material-42",
          courseId: "course-7",
          page: 12,
          slide: null,
          heading: "Memory Management",
          text: "RAM details",
        }),
      ],
    });
    expect(context.sources[0]).toEqual({
      chunkId: "a",
      materialId: "material-42",
      courseId: "course-7",
      text: "RAM details",
      score: 0.77,
      page: 12,
      slide: null,
      heading: "Memory Management",
    });
  });

  it("reports retrievalStatus: no_relevant_sources when there are no hits", () => {
    const context = build({ question: "q", hits: [] });
    expect(context.retrievalStatus).toBe("no_relevant_sources");
    expect(context.sources).toEqual([]);
  });

  it("reports retrievalStatus: no_relevant_sources when every hit is below threshold", () => {
    const context = build({ question: "q", hits: [hit({ id: "a", score: 0.05 })], minimumSimilarity: 0.3 });
    expect(context.retrievalStatus).toBe("no_relevant_sources");
  });

  it("reports retrievalStatus: ok when at least one source survives", () => {
    const context = build({ question: "q", hits: [hit({ id: "a", score: 0.9 })] });
    expect(context.retrievalStatus).toBe("ok");
  });

  it("deduplicates the same chunk id, keeping the highest score seen", () => {
    const context = build({
      question: "q",
      hits: [hit({ id: "dup", score: 0.4 }), hit({ id: "dup", score: 0.9 }), hit({ id: "dup", score: 0.6 })],
    });
    expect(context.sources).toHaveLength(1);
    expect(context.sources[0].score).toBe(0.9);
  });

  it("passes through academic and conversation context untouched", () => {
    const context = build({
      question: "q",
      hits: [],
      academicContext: { course: { id: "c1", code: "MTH101", title: "Calculus", grade: null } },
      conversationContext: [{ role: "user", content: "earlier question" }],
    });
    expect(context.academicContext).toEqual({ course: { id: "c1", code: "MTH101", title: "Calculus", grade: null } });
    expect(context.conversationContext).toEqual([{ role: "user", content: "earlier question" }]);
  });

  it("defaults academicContext to null and conversationContext to an empty array when omitted", () => {
    const context = build({ question: "q", hits: [] });
    expect(context.academicContext).toBeNull();
    expect(context.conversationContext).toEqual([]);
  });
});
