import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { connectToDatabase } from "@/lib/db";
import { getEmbeddingProvider } from "@/lib/embeddings/provider";
import { indexChunkVector } from "@/lib/retrieval/index-manager";
import { search } from "@/lib/retrieval/service";
import { AcademicYear } from "@/models/AcademicYear";
import { Course } from "@/models/Course";
import { Counter } from "@/models/Counter";
import { LearningMemory } from "@/models/LearningMemory";
import { MaterialChunk } from "@/models/MaterialChunk";
import { Semester } from "@/models/Semester";
import { StudyMaterial } from "@/models/StudyMaterial";
import { Task } from "@/models/Task";
import { User } from "@/models/User";
import { z } from "zod";
import { getAcademicContext } from "./academic-context";
import {
  LLMProviderError,
  type LLMGenerationRequest,
  type LLMGenerationResult,
  type LLMProvider,
  type StructuredLLMGenerationRequest,
  type StructuredLLMGenerationResult,
} from "./llm-provider";
import { ask, askStructured } from "./orchestrator";

/**
 * Exercises the real architecture end to end: real MongoDB, real
 * embeddings (via the actual Python subprocess), the real persistent
 * HNSW index, and the real AcademicContextProvider/ContextAssembler/
 * PromptBuilder — with a fake standing in only for the external LLM
 * boundary, per the task's own testing guidance ("mock only the external
 * LLM boundary, do not mock internal retrieval/context logic").
 */

class FakeLLMProvider implements LLMProvider {
  public lastRequest: LLMGenerationRequest | null = null;

  constructor(
    private readonly response: string | Error = "Fake answer citing the material.",
    private readonly structuredResponse: unknown = new Error("not used in these tests"),
  ) {}

  async generate(request: LLMGenerationRequest): Promise<LLMGenerationResult> {
    this.lastRequest = request;
    if (this.response instanceof Error) throw this.response;
    return { text: this.response, model: "fake-model", stopReason: "end_turn", usage: { inputTokens: 1, outputTokens: 1 } };
  }

  async generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult> {
    this.lastRequest = request;
    if (this.structuredResponse instanceof Error) throw this.structuredResponse;
    return {
      text: JSON.stringify(this.structuredResponse),
      structuredOutput: this.structuredResponse,
      model: "fake-model",
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
}

async function nextVectorLabel(): Promise<number> {
  const doc = await Counter.findByIdAndUpdate(
    "materialChunk.vectorLabel",
    { $inc: { seq: 1 } },
    { returnDocument: "after", upsert: true },
  ).lean();
  return doc.seq;
}

describe("AI orchestration — real Mongo + real embeddings + fake LLM boundary", () => {
  let userAId: string;
  let userBId: string;
  let userCId: string;
  let materialAId: string;
  let courseAId: string;

  beforeAll(async () => {
    await connectToDatabase();
    const stamp = Date.now();

    const userA = await User.create({ name: "AI Test A", email: `ai-test-a-${stamp}@example.com`, passwordHash: "x" });
    const userB = await User.create({ name: "AI Test B", email: `ai-test-b-${stamp}@example.com`, passwordHash: "x" });
    const userC = await User.create({ name: "AI Test C", email: `ai-test-c-${stamp}@example.com`, passwordHash: "x" });
    userAId = userA._id.toString();
    userBId = userB._id.toString();
    userCId = userC._id.toString();

    const year = await AcademicYear.create({ userId: userAId, label: `Integration ${stamp}`, isCurrent: true });
    const semester = await Semester.create({
      userId: userAId,
      academicYearId: year._id,
      name: "Fall",
      order: 1,
      isCurrent: true,
    });
    const course = await Course.create({
      userId: userAId,
      semesterId: semester._id,
      code: "CSC201",
      title: "Computer Architecture",
      creditUnits: 3,
    });
    courseAId = course._id.toString();

    await Task.create({
      userId: userAId,
      courseId: course._id,
      title: "Read chapter 4",
      type: "assignment",
      priority: "high",
      status: "todo",
      dueDate: new Date(Date.now() + 86400000),
    });
    await LearningMemory.create({
      userId: userAId,
      courseId: course._id,
      content: "I always confuse RAM and ROM.",
      category: "difficulty",
    });

    const materialA = await StudyMaterial.create({
      userId: userAId,
      courseId: course._id,
      originalFilename: "memory.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userAId}/${stamp}-a.pdf`,
      status: "ready",
    });
    materialAId = materialA._id.toString();

    const chunkTexts = [
      "RAM is volatile memory and loses stored information when power is removed.",
      "Solid state drives use flash memory chips to persist data without power.",
    ];
    const provider = getEmbeddingProvider();
    const { vectors, model, dimension } = await provider.embedDocuments(chunkTexts);

    for (let i = 0; i < chunkTexts.length; i++) {
      const label = await nextVectorLabel();
      await MaterialChunk.create({
        materialId: materialA._id,
        userId: userAId,
        courseId: course._id,
        chunkIndex: i,
        text: chunkTexts[i],
        pageStart: 12 + i,
        pageEnd: 12 + i,
        embedding: vectors[i],
        embeddingModel: model,
        embeddingDim: dimension,
        embeddingStatus: "embedded",
        embeddedAt: new Date(),
        vectorLabel: label,
      });
      await indexChunkVector(label, vectors[i], { materialId: materialAId, userId: userAId, courseId: courseAId });
    }

    // User B: unrelated material and no shared course, to prove isolation.
    const materialB = await StudyMaterial.create({
      userId: userBId,
      courseId: null,
      originalFilename: "history.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userBId}/${stamp}-b.pdf`,
      status: "ready",
    });
    const bText = "The Roman Republic was governed by elected magistrates and a senate.";
    const bEmbed = await provider.embedDocuments([bText]);
    const bLabel = await nextVectorLabel();
    await MaterialChunk.create({
      materialId: materialB._id,
      userId: userBId,
      courseId: null,
      chunkIndex: 0,
      text: bText,
      embedding: bEmbed.vectors[0],
      embeddingModel: bEmbed.model,
      embeddingDim: bEmbed.dimension,
      embeddingStatus: "embedded",
      embeddedAt: new Date(),
      vectorLabel: bLabel,
    });
    await indexChunkVector(bLabel, bEmbed.vectors[0], {
      materialId: materialB._id.toString(),
      userId: userBId,
      courseId: null,
    });
  }, 60000);

  afterAll(async () => {
    await MaterialChunk.deleteMany({ userId: { $in: [userAId, userBId] } });
    await StudyMaterial.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Task.deleteMany({ userId: userAId });
    await LearningMemory.deleteMany({ userId: userAId });
    await Course.deleteMany({ userId: userAId });
    await Semester.deleteMany({ userId: userAId });
    await AcademicYear.deleteMany({ userId: userAId });
    await User.deleteMany({ _id: { $in: [userAId, userBId, userCId] } });
  });

  it("question -> RetrievalService -> relevant MaterialChunks, using real embeddings", async () => {
    const hits = await search(userAId, "What happens to memory when electricity is switched off?");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].chunk.text).toContain("RAM is volatile memory");
  }, 30000);

  it("AcademicContextProvider returns this user's own real data, deliberately scoped", async () => {
    const context = await getAcademicContext(userAId, {
      includeCurrentAcademicPeriod: true,
      includeUpcomingTasks: true,
      includeRecentMemories: true,
    });
    expect(context.currentSemester?.name).toBe("Fall");
    expect(context.upcomingTasks?.[0]?.title).toBe("Read chapter 4");
    expect(context.recentMemories?.[0]?.content).toContain("RAM and ROM");
  });

  it("ownership: a courseId that belongs to a different user resolves to no course and no scoped data", async () => {
    const context = await getAcademicContext(userBId, { courseId: courseAId, includeUpcomingTasks: true });
    expect(context.course).toBeNull();
  });

  it("ownership: user B's retrieval never surfaces user A's chunks, even for a matching question", async () => {
    const hits = await search(userBId, "What happens to memory when electricity is switched off?");
    expect(hits.every((hit) => !hit.chunk.text.includes("RAM"))).toBe(true);
  }, 30000);

  it("AIOrchestrator.ask(): full real pipeline returns a typed, sourced result", async () => {
    const fake = new FakeLLMProvider("According to your material, RAM is volatile.");
    const result = await ask(
      userAId,
      {
        question: "What happens to memory when electricity is switched off?",
        courseId: courseAId,
        includeAcademicContext: true,
        includeUpcomingTasks: true,
        includeRecentMemories: true,
      },
      { llmProvider: fake },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.answer).toContain("volatile");
      expect(result.retrievalStatus).toBe("ok");
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].materialId).toBe(materialAId);
    }

    // The fake provider only ever sees what PromptBuilder actually
    // rendered — confirms real retrieved text and real academic context
    // reached the prompt, not placeholders.
    expect(fake.lastRequest?.userInput).toContain("RAM is volatile memory");
    expect(fake.lastRequest?.userInput).toContain("CSC201");
    expect(fake.lastRequest?.userInput).toContain("Read chapter 4");
  }, 30000);

  it("AIOrchestrator.ask(): reports no_relevant_sources rather than fabricating a match", async () => {
    // A user with zero indexed chunks at all — the deterministic way to
    // guarantee "nothing relevant," rather than relying on a topic being
    // "unrelated enough" to fall under the similarity floor (sentence
    // embeddings from the same broad domain can still score surprisingly
    // high — see RetrievalService's own comment on this).
    const fake = new FakeLLMProvider("I don't have relevant material for that.");
    const result = await ask(userCId, { question: "What happens to memory when electricity is switched off?" }, { llmProvider: fake });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.retrievalStatus).toBe("no_relevant_sources");
      expect(result.sources).toEqual([]);
    }
  }, 30000);

  it("AIOrchestrator.ask(): ownership isolation end-to-end, even when the caller supplies another user's materialId", async () => {
    const fake = new FakeLLMProvider("...");
    const result = await ask(
      userBId,
      { question: "volatile memory power removed", materialId: materialAId },
      { llmProvider: fake },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sources).toEqual([]);
      expect(result.retrievalStatus).toBe("no_relevant_sources");
    }
  }, 30000);

  it("AIOrchestrator.ask(): a genuine provider failure is handled gracefully, still reporting what was found", async () => {
    const failing = new FakeLLMProvider(new LLMProviderError("Simulated provider outage"));
    const result = await ask(
      userAId,
      { question: "What happens to memory when electricity is switched off?" },
      { llmProvider: failing },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/Simulated provider outage/);
      expect(result.retrievalStatus).toBe("ok");
      expect(result.sources.length).toBeGreaterThan(0);
    }
  }, 30000);

  it("AIOrchestrator.ask(): rejects an invalid request before touching retrieval or the LLM", async () => {
    const fake = new FakeLLMProvider("should not be called");
    const result = await ask(userAId, { question: "" }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    expect(fake.lastRequest).toBeNull();
  });

  const GenericSchema = z.object({ summary: z.string(), keyPoints: z.array(z.string()) });

  it("AIOrchestrator.askStructured(): shares the same real retrieval/context pipeline as ask(), validating the model's structured output", async () => {
    const fake = new FakeLLMProvider(undefined, { summary: "RAM loses data on power loss.", keyPoints: ["volatile", "fast"] });
    const result = await askStructured(
      userAId,
      { question: "What happens to memory when electricity is switched off?" },
      GenericSchema,
      "test_summary",
      { llmProvider: fake },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.summary).toContain("RAM");
      expect(result.retrievalStatus).toBe("ok");
      expect(result.sources.length).toBeGreaterThan(0);
      expect(result.sources[0].materialId).toBe(materialAId);
    }
    // Same trust-boundary prompt PromptBuilder always builds for ask().
    expect(fake.lastRequest?.userInput).toContain("RAM is volatile memory");
  }, 30000);

  it("AIOrchestrator.askStructured(): rejects output that doesn't match the schema, still reporting real sources found", async () => {
    const fake = new FakeLLMProvider(undefined, { summary: "RAM loses data.", keyPoints: "not an array" });
    const result = await askStructured(
      userAId,
      { question: "What happens to memory when electricity is switched off?" },
      GenericSchema,
      "test_summary",
      { llmProvider: fake },
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/schema/);
      expect(result.retrievalStatus).toBe("ok");
      expect(result.sources.length).toBeGreaterThan(0);
    }
  }, 30000);

  it("AIOrchestrator.askStructured(): ownership isolation holds the same as ask()", async () => {
    const fake = new FakeLLMProvider(undefined, { summary: "n/a", keyPoints: [] });
    const result = await askStructured(
      userBId,
      { question: "volatile memory power removed", materialId: materialAId },
      GenericSchema,
      "test_summary",
      { llmProvider: fake },
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.sources).toEqual([]);
      expect(result.retrievalStatus).toBe("no_relevant_sources");
    }
  }, 30000);
});
