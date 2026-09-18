import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { VectorIndexError, VectorIndexService } from "./vector-index";

const DIM = 384;

function vec(seed: number): number[] {
  // A deterministic, distinguishable 384-dim vector per seed — not a real
  // embedding, but real numeric data exercised through the real hnswlib
  // native addon (no mocks).
  return Array.from({ length: DIM }, (_, i) => Math.sin(seed * 7919 + i));
}

function owner(materialId: string, userId = "user-1", courseId: string | null = null) {
  return { materialId, userId, courseId };
}

let tempDir: string;

beforeEach(() => {
  tempDir = mkdtempSync(path.join(tmpdir(), "vector-index-test-"));
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

describe("VectorIndexService", () => {
  it("starts empty", () => {
    const index = VectorIndexService.createEmpty();
    expect(index.size).toBe(0);
  });

  it("adds points and finds the nearest neighbor for a matching query", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.upsertPoint(2, vec(2), owner("material-2"));
    index.upsertPoint(3, vec(3), owner("material-3"));

    expect(index.size).toBe(3);

    const hits = index.search(vec(2), 1, () => true);
    expect(hits).toHaveLength(1);
    expect(hits[0].label).toBe(2);
    expect(hits[0].score).toBeGreaterThan(0.99); // near-identical vector -> cosine similarity ~1
  });

  it("rejects a vector with the wrong dimension", () => {
    const index = VectorIndexService.createEmpty();
    expect(() => index.upsertPoint(1, [1, 2, 3], owner("material-1"))).toThrow(VectorIndexError);
  });

  it("rejects a query vector with the wrong dimension", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    expect(() => index.search([1, 2, 3], 1, () => true)).toThrow(VectorIndexError);
  });

  it("update: re-embedding the same chunk overwrites its vector in place at the same label", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.upsertPoint(1, vec(99), owner("material-1")); // same material, same label -> update

    expect(index.size).toBe(1);
    const hits = index.search(vec(99), 1, () => true);
    expect(hits[0].label).toBe(1);
    expect(hits[0].score).toBeGreaterThan(0.99);
  });

  it("refuses to let one label silently take over another chunk's vector (duplicate ID protection)", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    expect(() => index.upsertPoint(1, vec(2), owner("material-2"))).toThrow(VectorIndexError);
    // the original point must be untouched after the rejected overwrite
    expect(index.getOwner(1)?.materialId).toBe("material-1");
  });

  it("delete: markDeleted removes a point from search results and from size", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.upsertPoint(2, vec(2), owner("material-2"));

    index.markDeleted(1);

    expect(index.size).toBe(1);
    const hits = index.search(vec(1), 10, () => true);
    expect(hits.map((h) => h.label)).not.toContain(1);
  });

  it("delete is idempotent: marking an already-deleted or never-indexed label is a no-op", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.markDeleted(1);
    expect(() => index.markDeleted(1)).not.toThrow();
    expect(() => index.markDeleted(999)).not.toThrow();
    expect(index.size).toBe(0);
  });

  it("ownership filter is applied natively during search, not just after the fact", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1", "user-a"));
    index.upsertPoint(2, vec(1), owner("material-2", "user-b"));

    const hitsForA = index.search(vec(1), 10, (o) => o.userId === "user-a");
    expect(hitsForA.map((h) => h.label)).toEqual([1]);

    const hitsForB = index.search(vec(1), 10, (o) => o.userId === "user-b");
    expect(hitsForB.map((h) => h.label)).toEqual([2]);
  });

  it("search returns an empty array when the filter excludes everything, rather than throwing", () => {
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    const hits = index.search(vec(1), 10, () => false);
    expect(hits).toEqual([]);
  });

  it("search returns an empty array on an empty index", () => {
    const index = VectorIndexService.createEmpty();
    expect(index.search(vec(1), 5, () => true)).toEqual([]);
  });

  it("grows capacity automatically past the initial size", () => {
    const index = VectorIndexService.createEmpty(2);
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.upsertPoint(2, vec(2), owner("material-2"));
    // a 3rd distinct label beyond the initial capacity of 2 must not throw
    expect(() => index.upsertPoint(3, vec(3), owner("material-3"))).not.toThrow();
    expect(index.size).toBe(3);
  });

  it("persists to disk and reloads with the same vectors, owners rebuilt separately", () => {
    const filePath = path.join(tempDir, "hnsw.index");
    const index = VectorIndexService.createEmpty();
    index.upsertPoint(1, vec(1), owner("material-1"));
    index.upsertPoint(2, vec(2), owner("material-2"));
    index.persist(filePath);

    const reloaded = VectorIndexService.loadOrCreate(filePath);
    // Ownership isn't persisted in the index file (by design — MongoDB is
    // the source of truth for it), so a freshly loaded index has none set
    // until the caller rebuilds it; the raw vectors/labels are still there.
    reloaded.setOwnershipMap(
      new Map([
        [1, owner("material-1")],
        [2, owner("material-2")],
      ]),
    );
    const hits = reloaded.search(vec(1), 1, () => true);
    expect(hits[0].label).toBe(1);
    expect(hits[0].score).toBeGreaterThan(0.99);
  });

  it("creates a fresh empty index when no persisted file exists yet", () => {
    const filePath = path.join(tempDir, "does-not-exist.index");
    const index = VectorIndexService.loadOrCreate(filePath);
    expect(index.size).toBe(0);
  });

  it("throws VectorIndexError with a recovery hint when the persisted file is corrupted", () => {
    const filePath = path.join(tempDir, "corrupt.index");
    writeFileSync(filePath, "not a real hnsw index file");
    expect(() => VectorIndexService.loadOrCreate(filePath)).toThrow(VectorIndexError);
    expect(() => VectorIndexService.loadOrCreate(filePath)).toThrow(/rebuild/i);
  });
});
