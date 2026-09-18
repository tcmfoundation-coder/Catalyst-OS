import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Types } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import type { LLMGenerationResult, LLMProvider, StructuredLLMGenerationRequest, StructuredLLMGenerationResult } from "@/lib/ai/llm-provider";
import { AcademicYear } from "@/models/AcademicYear";
import { Course } from "@/models/Course";
import { MaterialChunk } from "@/models/MaterialChunk";
import { Semester } from "@/models/Semester";
import { StudyMaterial } from "@/models/StudyMaterial";
import { StudyResource } from "@/models/StudyResource";
import { User } from "@/models/User";
import { deleteStudyResource, findOwnedStudyResource, getStudyResource, listStudyResources } from "./resources";
import { generateStudyNotes } from "./service";

/**
 * Real MongoDB, fake LLM boundary — same testing philosophy used
 * throughout this app's AI features. getMaterialCoverage() needs no
 * embeddings, so fixtures are just StudyMaterial + MaterialChunk rows.
 */

class FakeLLMProvider implements LLMProvider {
  public lastRequest: StructuredLLMGenerationRequest | null = null;

  constructor(private readonly response: unknown = validNotesResponse()) {}

  async generate(): Promise<LLMGenerationResult> {
    throw new Error("study notes generation only uses structured generation");
  }

  async generateStructured(request: StructuredLLMGenerationRequest): Promise<StructuredLLMGenerationResult> {
    this.lastRequest = request;
    if (this.response instanceof Error) throw this.response;
    return {
      text: JSON.stringify(this.response),
      structuredOutput: this.response,
      model: "fake-model",
      stopReason: "end_turn",
      usage: { inputTokens: 1, outputTokens: 1 },
    };
  }
}

function validNotesResponse() {
  return {
    title: "Networking Basics",
    overview: "Covers the OSI model.",
    sections: [
      {
        heading: "The OSI Model",
        summary: "Seven layers describe network communication.",
        keyPoints: ["Seven layers total."],
        definitions: [{ term: "OSI", definition: "Open Systems Interconnection." }],
        examples: ["HTTP runs at the application layer."],
      },
    ],
  };
}

describe("study-resources/service — generateStudyNotes (real Mongo + fake LLM)", () => {
  let userAId: string;
  let userBId: string;
  let courseAId: string;
  let materialAId: string;
  let materialNotReadyId: string;
  let materialEmptyId: string;
  let materialBId: string;

  beforeAll(async () => {
    await connectToDatabase();
    const stamp = Date.now();

    const userA = await User.create({ name: "Notes Test A", email: `notes-a-${stamp}@example.com`, passwordHash: "x" });
    const userB = await User.create({ name: "Notes Test B", email: `notes-b-${stamp}@example.com`, passwordHash: "x" });
    userAId = userA._id.toString();
    userBId = userB._id.toString();

    const year = await AcademicYear.create({ userId: userAId, label: `Notes ${stamp}`, isCurrent: true });
    const semester = await Semester.create({ userId: userAId, academicYearId: year._id, name: "Fall", order: 1, isCurrent: true });
    const course = await Course.create({ userId: userAId, semesterId: semester._id, code: "NET101", title: "Networking", creditUnits: 3 });
    courseAId = course._id.toString();

    const materialA = await StudyMaterial.create({
      userId: userAId,
      courseId: course._id,
      originalFilename: "networking.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userAId}/${stamp}-a.pdf`,
      status: "ready",
    });
    materialAId = materialA._id.toString();
    await MaterialChunk.insertMany([
      { materialId: materialA._id, userId: userAId, courseId: course._id, chunkIndex: 0, text: "The OSI model has seven layers.", heading: "Intro" },
      { materialId: materialA._id, userId: userAId, courseId: course._id, chunkIndex: 1, text: "Layer 4 is the transport layer.", heading: "Transport" },
    ]);

    const materialNotReady = await StudyMaterial.create({
      userId: userAId,
      originalFilename: "processing.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userAId}/${stamp}-processing.pdf`,
      status: "processing",
    });
    materialNotReadyId = materialNotReady._id.toString();

    const materialEmpty = await StudyMaterial.create({
      userId: userAId,
      originalFilename: "empty.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userAId}/${stamp}-empty.pdf`,
      status: "ready",
    });
    materialEmptyId = materialEmpty._id.toString();

    const materialB = await StudyMaterial.create({
      userId: userBId,
      originalFilename: "other-user.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userBId}/${stamp}-b.pdf`,
      status: "ready",
    });
    materialBId = materialB._id.toString();
    await MaterialChunk.create({ materialId: materialB._id, userId: userBId, courseId: null, chunkIndex: 0, text: "User B's own content." });
  }, 30000);

  afterAll(async () => {
    await StudyResource.deleteMany({ userId: { $in: [userAId, userBId] } });
    await MaterialChunk.deleteMany({ userId: { $in: [userAId, userBId] } });
    await StudyMaterial.deleteMany({ userId: { $in: [userAId, userBId] } });
    await Course.deleteMany({ userId: userAId });
    await Semester.deleteMany({ userId: userAId });
    await AcademicYear.deleteMany({ userId: userAId });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  });

  // --- Success ---

  it("generates and persists notes with real attached sources", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: materialAId }, { llmProvider: fake });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.content.title).toBe("Networking Basics");
    expect(result.content.sections).toHaveLength(1);
    expect(result.sources.length).toBeGreaterThan(0);
    expect(result.sources.every((source) => source.materialId === materialAId)).toBe(true);

    const stored = await StudyResource.findById(result.resourceId);
    expect(stored).not.toBeNull();
    expect(stored?.type).toBe("notes");
    expect(stored?.userId.toString()).toBe(userAId);
    expect(stored?.materialId.toString()).toBe(materialAId);
  }, 30000);

  it("associates the resource with an explicitly supplied, owned course", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: materialAId, courseId: courseAId }, { llmProvider: fake });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const stored = await StudyResource.findById(result.resourceId);
    expect(stored?.courseId?.toString()).toBe(courseAId);
  }, 30000);

  // --- Material validation ---

  it("rejects a material that isn't ready yet, without calling the LLM", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: materialNotReadyId }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/isn't ready/i);
    expect(fake.lastRequest).toBeNull();
  });

  it("rejects a nonexistent materialId", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: "aaaaaaaaaaaaaaaaaaaaaaaa" }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not found/i);
  });

  it("rejects a malformed materialId without throwing", async () => {
    const fake = new FakeLLMProvider();
    await expect(generateStudyNotes(userAId, { materialId: "not-a-valid-id" }, { llmProvider: fake })).resolves.toMatchObject({
      ok: false,
    });
  });

  // --- No usable content ---

  it("refuses to fabricate notes when the material has no usable chunks", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: materialEmptyId }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/no usable content/i);
    expect(fake.lastRequest).toBeNull();
    const resources = await StudyResource.find({ materialId: materialEmptyId });
    expect(resources).toHaveLength(0);
  }, 30000);

  // --- Failure behavior ---

  it("LLM failure returns a safe generic error and persists nothing", async () => {
    const failing = new FakeLLMProvider(new Error("upstream 401: invalid api key"));
    const result = await generateStudyNotes(userAId, { materialId: materialAId }, { llmProvider: failing });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).not.toMatch(/401|api key|upstream/i);
    const resourcesBefore = await StudyResource.countDocuments({ userId: userAId, materialId: materialAId });
    expect(resourcesBefore).toBe(2); // only the two successful generations from earlier tests
  }, 30000);

  it("invalid structured output (missing required field) is never persisted", async () => {
    const badOutput = new FakeLLMProvider({ overview: "Missing a title.", sections: [] });
    const result = await generateStudyNotes(userAId, { materialId: materialAId }, { llmProvider: badOutput });
    expect(result.ok).toBe(false);
  }, 30000);

  it("a model trying to inject fake sources never gets them persisted", async () => {
    const malicious = new FakeLLMProvider({
      ...validNotesResponse(),
      sources: [{ chunkId: "fake", materialId: "fake", page: 999 }],
    });
    const result = await generateStudyNotes(userAId, { materialId: materialAId }, { llmProvider: malicious });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.sources.some((source) => source.chunkId === "fake")).toBe(false);
  }, 30000);

  // --- Ownership / security ---

  it("SECURITY: user A cannot generate notes from user B's material", async () => {
    const fake = new FakeLLMProvider();
    const result = await generateStudyNotes(userAId, { materialId: materialBId }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not found/i);
    expect(fake.lastRequest).toBeNull();
  });

  it("SECURITY: a foreign courseId is rejected", async () => {
    const fake = new FakeLLMProvider();
    const foreignYear = await AcademicYear.create({ userId: userBId, label: "Foreign Year", isCurrent: true });
    const foreignSemester = await Semester.create({ userId: userBId, academicYearId: foreignYear._id, name: "Fall", order: 1, isCurrent: true });
    const foreignCourse = await Course.create({ userId: userBId, semesterId: foreignSemester._id, code: "FOREIGN101", title: "Not yours", creditUnits: 3 });

    const result = await generateStudyNotes(userAId, { materialId: materialAId, courseId: foreignCourse._id.toString() }, { llmProvider: fake });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/course not found/i);

    await Course.deleteOne({ _id: foreignCourse._id });
    await Semester.deleteOne({ _id: foreignSemester._id });
    await AcademicYear.deleteOne({ _id: foreignYear._id });
  });
});

describe("study-resources/resources — real Mongo CRUD + ownership", () => {
  let userAId: string;
  let userBId: string;
  let resourceAId: string;
  let materialAId: string;

  beforeAll(async () => {
    await connectToDatabase();
    const stamp = Date.now();
    const userA = await User.create({ name: "Resource CRUD A", email: `resource-crud-a-${stamp}@example.com`, passwordHash: "x" });
    const userB = await User.create({ name: "Resource CRUD B", email: `resource-crud-b-${stamp}@example.com`, passwordHash: "x" });
    userAId = userA._id.toString();
    userBId = userB._id.toString();

    const materialA = await StudyMaterial.create({
      userId: userAId,
      originalFilename: "crud-material.pdf",
      format: "pdf",
      fileSizeBytes: 100,
      storageKey: `materials/${userAId}/${stamp}-crud.pdf`,
      status: "ready",
    });
    materialAId = materialA._id.toString();

    const resource = await StudyResource.create({
      userId: userAId,
      type: "notes",
      title: "Test Notes",
      materialId: materialA._id,
      courseId: null,
      content: { title: "Test Notes", overview: "An overview.", sections: [] },
      sources: [{ chunkId: "c1", materialId: materialAId, courseId: null, page: 1, slide: null, heading: null, score: 1 }],
    });
    resourceAId = resource._id.toString();
  });

  afterAll(async () => {
    await StudyResource.deleteMany({ userId: { $in: [userAId, userBId] } });
    await StudyMaterial.deleteMany({ userId: { $in: [userAId, userBId] } });
    await User.deleteMany({ _id: { $in: [userAId, userBId] } });
  });

  it("lists only the owner's resources, optionally scoped to a material", async () => {
    const list = await listStudyResources(userAId);
    expect(list.some((r) => r.id === resourceAId)).toBe(true);

    const scoped = await listStudyResources(userAId, { materialId: materialAId });
    expect(scoped.map((r) => r.id)).toContain(resourceAId);

    const asIntruder = await listStudyResources(userBId);
    expect(asIntruder.some((r) => r.id === resourceAId)).toBe(false);
  });

  it("reads a resource with its content and sources", async () => {
    const detail = await getStudyResource(userAId, resourceAId);
    expect(detail).not.toBeNull();
    expect(detail?.content).toMatchObject({ title: "Test Notes" });
    expect(detail?.sources).toHaveLength(1);
  });

  it("SECURITY: another user cannot read, delete, or otherwise access the resource", async () => {
    expect(await getStudyResource(userBId, resourceAId)).toBeNull();
    expect(await findOwnedStudyResource(userBId, resourceAId)).toBeNull();
    expect(await deleteStudyResource(userBId, resourceAId)).toBe(false);

    const stillExists = await StudyResource.findById(resourceAId);
    expect(stillExists).not.toBeNull();
  });

  it("SECURITY: a nonexistent or malformed resourceId behaves identically to a foreign one", async () => {
    const randomId = new Types.ObjectId().toString();
    expect(await getStudyResource(userAId, randomId)).toBeNull();
    expect(await getStudyResource(userAId, "not-a-valid-id")).toBeNull();
    expect(await deleteStudyResource(userAId, randomId)).toBe(false);
  });

  it("deletes a resource for its owner", async () => {
    const toDelete = await StudyResource.create({
      userId: userAId,
      type: "notes",
      title: "To delete",
      materialId: materialAId,
      courseId: null,
      content: { title: "To delete", overview: "x", sections: [] },
      sources: [],
    });
    const deleted = await deleteStudyResource(userAId, toDelete._id.toString());
    expect(deleted).toBe(true);
    expect(await StudyResource.findById(toDelete._id)).toBeNull();
  });
});
