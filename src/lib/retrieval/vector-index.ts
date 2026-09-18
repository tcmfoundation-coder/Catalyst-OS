import "server-only";
import { HierarchicalNSW } from "hnswlib-node";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { CURRENT_EMBEDDING_DIMENSION } from "@/lib/embeddings/constants";

/**
 * The only file in this app allowed to import hnswlib-node. Everything
 * above this (index-manager.ts for writes, RetrievalService for reads)
 * talks to VectorIndexService, never to HierarchicalNSW directly — so
 * swapping the ANN library later touches exactly this file.
 *
 * Cosine space matches how embedding similarity is normally compared for
 * sentence-embedding models like the one in
 * processor/processor/embedding/provider.py.
 */
const SPACE = "cosine" as const;
const DEFAULT_INITIAL_CAPACITY = 1000;

export const VECTOR_INDEX_DIR = process.env.VECTOR_INDEX_DIR ?? path.join(process.cwd(), ".vector-index");
export const VECTOR_INDEX_FILE = path.join(VECTOR_INDEX_DIR, "hnsw.index");

export class VectorIndexError extends Error {}

export interface VectorOwner {
  materialId: string;
  userId: string;
  courseId: string | null;
}

export interface VectorSearchHit {
  label: number;
  score: number;
}

/**
 * A thin, app-specific wrapper around hnswlib-node's HierarchicalNSW.
 * Holds an in-memory label -> VectorOwner map alongside the index so
 * ownership can be enforced as a *native* pre-filter during searchKnn,
 * not just after the fact. This map is intentionally not persisted to
 * disk — see index-manager.ts, which rebuilds it from MongoDB (the
 * source of truth for who owns which chunk) every time an index is
 * loaded or created, cheaply, via a lightweight projection query.
 */
export class VectorIndexService {
  private index: HierarchicalNSW;
  private owners = new Map<number, VectorOwner>();
  private capacity: number;

  private constructor(index: HierarchicalNSW, capacity: number) {
    this.index = index;
    this.capacity = capacity;
  }

  static createEmpty(initialCapacity = DEFAULT_INITIAL_CAPACITY): VectorIndexService {
    const index = new HierarchicalNSW(SPACE, CURRENT_EMBEDDING_DIMENSION);
    index.initIndex(initialCapacity);
    return new VectorIndexService(index, initialCapacity);
  }

  /** Loads the persisted index file, or returns a fresh empty index if none exists yet (first run). */
  static loadOrCreate(filePath: string = VECTOR_INDEX_FILE, initialCapacity = DEFAULT_INITIAL_CAPACITY): VectorIndexService {
    if (!existsSync(filePath)) {
      return VectorIndexService.createEmpty(initialCapacity);
    }
    try {
      const index = new HierarchicalNSW(SPACE, CURRENT_EMBEDDING_DIMENSION);
      index.readIndexSync(filePath);
      return new VectorIndexService(index, index.getMaxElements());
    } catch (error) {
      throw new VectorIndexError(
        `Failed to load persisted vector index at ${filePath}: ` +
          `${error instanceof Error ? error.message : String(error)}. ` +
          "The index file may be corrupted or built for a different dimensionality — " +
          "use the rebuild-from-MongoDB operation to recover.",
      );
    }
  }

  /** The count of currently-searchable (non-deleted) vectors — the owners map is the single source of truth for this, since hnswlib's own getCurrentCount() never decreases on markDelete. */
  get size(): number {
    return this.owners.size;
  }

  getOwner(label: number): VectorOwner | undefined {
    return this.owners.get(label);
  }

  private ensureCapacityFor(additionalLabel: number): void {
    if (this.owners.has(additionalLabel)) return; // overwriting an existing label never grows the index
    if (this.index.getCurrentCount() >= this.capacity) {
      this.capacity *= 2;
      this.index.resizeIndex(this.capacity);
    }
  }

  /**
   * Adds a new vector or re-embeds an existing one at the same label —
   * hnswlib overwrites a point in place when addPoint is called again
   * with a label it already has, which is exactly what "Update" (a
   * chunk got invalidated and re-embedded) needs. The one thing this
   * guards against explicitly is a genuine duplicate-ID bug: the same
   * label being claimed by two *different* chunks, which must never be
   * allowed to silently overwrite one chunk's vector with another's.
   */
  upsertPoint(label: number, vector: number[], owner: VectorOwner): void {
    if (vector.length !== CURRENT_EMBEDDING_DIMENSION) {
      throw new VectorIndexError(
        `Vector has dimension ${vector.length}, but this index requires ${CURRENT_EMBEDDING_DIMENSION}`,
      );
    }
    const existingOwner = this.owners.get(label);
    if (existingOwner && existingOwner.materialId !== owner.materialId) {
      throw new VectorIndexError(
        `Duplicate vector label ${label}: already assigned to material ${existingOwner.materialId}, ` +
          `refusing to overwrite with material ${owner.materialId}`,
      );
    }

    this.ensureCapacityFor(label);
    this.index.addPoint(vector, label);
    this.owners.set(label, owner);
  }

  /** Idempotent: marking an already-absent (or never-indexed) label as deleted is a no-op, not an error. */
  markDeleted(label: number): void {
    if (!this.owners.has(label)) return;
    this.index.markDelete(label);
    this.owners.delete(label);
  }

  setOwnershipMap(owners: Map<number, VectorOwner>): void {
    this.owners = owners;
  }

  /**
   * Searches for the topK nearest neighbors, applying `filter` natively
   * inside hnswlib's own traversal (pre-filtering) rather than
   * over-fetching and filtering afterward — hnswlib-node supports this
   * directly via searchKnn's optional FilterFunction argument.
   */
  search(queryVector: number[], topK: number, filter: (owner: VectorOwner) => boolean): VectorSearchHit[] {
    if (queryVector.length !== CURRENT_EMBEDDING_DIMENSION) {
      throw new VectorIndexError(
        `Query vector has dimension ${queryVector.length}, but this index requires ${CURRENT_EMBEDDING_DIMENSION}`,
      );
    }
    if (this.owners.size === 0 || topK <= 0) return [];

    const nativeFilter = (label: number): boolean => {
      const owner = this.owners.get(label);
      return owner !== undefined && filter(owner);
    };

    const { neighbors, distances } = this.index.searchKnn(queryVector, topK, nativeFilter);
    // cosine space distance is `1 - cosine similarity`, so similarity = 1 - distance.
    return neighbors.map((label, i) => ({ label, score: 1 - distances[i] }));
  }

  persist(filePath: string = VECTOR_INDEX_FILE): void {
    mkdirSync(path.dirname(filePath), { recursive: true });
    this.index.writeIndexSync(filePath);
  }
}
