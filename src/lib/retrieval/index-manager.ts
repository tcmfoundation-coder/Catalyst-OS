import "server-only";
import { connectToDatabase } from "@/lib/db";
import { CURRENT_EMBEDDING_MODEL } from "@/lib/embeddings/constants";
import { MaterialChunk } from "@/models/MaterialChunk";
import { VectorIndexService, type VectorOwner, type VectorSearchHit } from "./vector-index";

/**
 * Owns the single, process-wide VectorIndexService instance and its
 * synchronization with MongoDB. This is the only module (besides
 * vector-index.ts itself) allowed to construct or persist a
 * VectorIndexService — the embedding pipeline and RetrievalService both
 * go through the functions here, never touching hnswlib-node directly.
 *
 * The ownership map is deliberately rebuilt from MongoDB every time the
 * index is (re)loaded rather than persisted alongside the binary index
 * file: MongoDB is already the source of truth for who owns each chunk,
 * so persisting a second copy would just be another place for that fact
 * to drift out of sync. Filtering this map to `embeddingModel:
 * CURRENT_EMBEDDING_MODEL` also does double duty as staleness
 * enforcement: a chunk embedded by a since-replaced model has no entry
 * here, so it's invisible to search even before anything has physically
 * removed its old vector from the on-disk index.
 */

let singleton: VectorIndexService | null = null;
let loadingPromise: Promise<VectorIndexService> | null = null;

interface OwnershipRow {
  vectorLabel: number | null;
  materialId: { toString(): string };
  userId: { toString(): string };
  courseId: { toString(): string } | null;
}

function toOwner(row: OwnershipRow): VectorOwner {
  return {
    materialId: row.materialId.toString(),
    userId: row.userId.toString(),
    courseId: row.courseId ? row.courseId.toString() : null,
  };
}

async function buildOwnershipMap(): Promise<Map<number, VectorOwner>> {
  await connectToDatabase();
  const rows = await MaterialChunk.find({
    embeddingStatus: "embedded",
    embeddingModel: CURRENT_EMBEDDING_MODEL,
    vectorLabel: { $ne: null },
  })
    .select("vectorLabel materialId userId courseId")
    .lean();

  const map = new Map<number, VectorOwner>();
  for (const row of rows) {
    if (row.vectorLabel == null) continue;
    map.set(row.vectorLabel, toOwner(row));
  }
  return map;
}

async function loadIndex(): Promise<VectorIndexService> {
  const index = VectorIndexService.loadOrCreate();
  index.setOwnershipMap(await buildOwnershipMap());
  return index;
}

/**
 * Lazily loads (once per process) the persisted index and rebuilds its
 * ownership map from MongoDB. Concurrent callers during the first load
 * await the same in-flight promise instead of racing to load twice.
 */
export async function getVectorIndex(): Promise<VectorIndexService> {
  if (singleton) return singleton;
  if (!loadingPromise) {
    loadingPromise = loadIndex()
      .then((index) => {
        singleton = index;
        return index;
      })
      .finally(() => {
        loadingPromise = null;
      });
  }
  return loadingPromise;
}

/** Test-only: forces the next getVectorIndex() call to reload from disk/MongoDB. */
export function resetVectorIndexForTests(): void {
  singleton = null;
  loadingPromise = null;
}

export async function indexChunkVector(label: number, vector: number[], owner: VectorOwner): Promise<void> {
  const index = await getVectorIndex();
  index.upsertPoint(label, vector, owner);
  index.persist();
}

export async function removeChunkVector(label: number): Promise<void> {
  const index = await getVectorIndex();
  index.markDeleted(label);
  index.persist();
}

export async function searchVectorIndex(
  queryVector: number[],
  topK: number,
  filter: (owner: VectorOwner) => boolean,
): Promise<VectorSearchHit[]> {
  const index = await getVectorIndex();
  return index.search(queryVector, topK, filter);
}

export interface RebuildSummary {
  indexed: number;
  skipped: number;
}

/**
 * Explicit, safe, controlled rebuild: reconstructs the index entirely
 * from MongoDB's stored embeddings, with no re-embedding required
 * (MaterialChunk.embedding is the source of truth for the vector data
 * itself). For corruption recovery, deployment recovery, or debugging —
 * never run implicitly on startup (see vector-index.ts's loadOrCreate,
 * which only creates an empty index when no file exists, it never
 * rebuilds from Mongo on its own). A single chunk with a corrupted or
 * mismatched stored vector is skipped, not fatal to the whole rebuild;
 * the file on disk is only overwritten once the new index is fully
 * built, so a crash mid-rebuild leaves the previous index intact.
 */
export async function rebuildVectorIndexFromMongo(): Promise<RebuildSummary> {
  await connectToDatabase();
  const chunks = await MaterialChunk.find({
    embeddingStatus: "embedded",
    embeddingModel: CURRENT_EMBEDDING_MODEL,
    vectorLabel: { $ne: null },
  })
    .select("vectorLabel materialId userId courseId embedding")
    .lean();

  const fresh = VectorIndexService.createEmpty(Math.max(1000, chunks.length * 2));
  let indexed = 0;
  let skipped = 0;

  for (const chunk of chunks) {
    if (chunk.vectorLabel == null || !chunk.embedding || chunk.embedding.length === 0) {
      skipped++;
      continue;
    }
    try {
      fresh.upsertPoint(chunk.vectorLabel, chunk.embedding, toOwner(chunk));
      indexed++;
    } catch {
      // A dimension mismatch or label collision on one row must not abort
      // the rebuild for every other chunk.
      skipped++;
    }
  }

  fresh.persist();
  singleton = fresh;
  return { indexed, skipped };
}
