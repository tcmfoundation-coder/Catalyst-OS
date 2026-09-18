import "server-only";
import type { HydratedDocument } from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { indexChunkVector } from "@/lib/retrieval/index-manager";
import { MaterialChunk, type IMaterialChunk } from "@/models/MaterialChunk";
import { getNextSequence } from "@/models/Counter";
import { CURRENT_EMBEDDING_MODEL } from "./constants";
import { EmbeddingProviderError, getEmbeddingProvider } from "./provider";

type ChunkDoc = HydratedDocument<IMaterialChunk>;

const VECTOR_LABEL_COUNTER = "materialChunk.vectorLabel";
// fastembed loads the ONNX model once per process and then batches
// inference — embedding N texts in one call is far cheaper than N calls,
// but an unbounded batch means one huge material blocks everything else
// and risks a single oversized subprocess payload. This caps it.
const EMBEDDING_BATCH_SIZE = 32;

export interface EmbedChunksSummary {
  embedded: number;
  failed: number;
}

// A chunk needs (re-)embedding if it was never embedded, previously
// failed, or was embedded by a model that isn't the current one
// (staleness) — inlined into both entry points below since it's a
// literal object Mongoose's query types need to see directly to resolve
// the right overload.

/**
 * Embeds and indexes every not-yet-current chunk belonging to one
 * material. Called right after study-materials/processing.ts persists a
 * material's chunks. Idempotent and safe to re-run: chunks already
 * embedded under the current model are skipped, so re-running after a
 * partial failure only retries what didn't finish. Embedding failure
 * here never flips the material itself back to "failed" — text
 * extraction already succeeded and that's still useful on its own;
 * "searchable via retrieval" is tracked per-chunk instead (see
 * MaterialChunk.embeddingStatus).
 */
export async function embedMaterialChunks(materialId: string): Promise<EmbedChunksSummary> {
  await connectToDatabase();
  const chunks = await MaterialChunk.find({
    materialId,
    $or: [{ embeddingStatus: { $ne: "embedded" } }, { embeddingModel: { $ne: CURRENT_EMBEDDING_MODEL } }],
  });
  return embedChunks(chunks);
}

/**
 * Embeds chunks across the whole corpus that are pending, failed, or
 * stale relative to the current model — for backfilling chunks that
 * existed before this pipeline did, and for migrating everything after a
 * deliberate model change (see lib/embeddings/constants.ts). Bounded by
 * `limit` per call so a huge backlog can be worked through incrementally
 * (e.g. from a script or an admin action) instead of one unbounded run.
 */
export async function backfillPendingChunks(limit = 200): Promise<EmbedChunksSummary> {
  await connectToDatabase();
  const chunks = await MaterialChunk.find({
    $or: [{ embeddingStatus: { $ne: "embedded" } }, { embeddingModel: { $ne: CURRENT_EMBEDDING_MODEL } }],
  }).limit(limit);
  return embedChunks(chunks);
}

async function embedChunks(chunks: ChunkDoc[]): Promise<EmbedChunksSummary> {
  let embedded = 0;
  let failed = 0;

  for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
    const validBatch = batch.filter((chunk) => chunk.text.trim().length > 0);
    const skippedAsMalformed = batch.length - validBatch.length;
    if (skippedAsMalformed > 0) {
      const malformed = batch.filter((chunk) => chunk.text.trim().length === 0);
      await Promise.all(malformed.map((chunk) => markChunkFailed(chunk, "Chunk text is empty")));
      failed += skippedAsMalformed;
    }
    if (validBatch.length === 0) continue;

    let vectors: number[][];
    let model: string;
    let dimension: number;
    try {
      const provider = getEmbeddingProvider();
      const result = await provider.embedDocuments(validBatch.map((chunk) => chunk.text));
      vectors = result.vectors;
      model = result.model;
      dimension = result.dimension;
    } catch (error) {
      // The whole batch failed (e.g. the embedding model/process is
      // unavailable) — mark every chunk in it failed individually so
      // none are silently left in an ambiguous "pending" state.
      const message = error instanceof EmbeddingProviderError ? error.message : "Embedding process failed";
      await Promise.all(validBatch.map((chunk) => markChunkFailed(chunk, message)));
      failed += validBatch.length;
      continue;
    }

    for (let j = 0; j < validBatch.length; j++) {
      const chunk = validBatch[j];
      try {
        const label = chunk.vectorLabel ?? (await getNextSequence(VECTOR_LABEL_COUNTER));
        // The vector is written to the index — and durably persisted to
        // disk — before MongoDB is told this chunk is "embedded", so a
        // failure here (or a crash) never leaves MongoDB claiming an
        // embedding is indexed when it isn't.
        await indexChunkVector(label, vectors[j], {
          materialId: chunk.materialId.toString(),
          userId: chunk.userId.toString(),
          courseId: chunk.courseId ? chunk.courseId.toString() : null,
        });

        chunk.embedding = vectors[j];
        chunk.embeddingModel = model;
        chunk.embeddingDim = dimension;
        chunk.embeddingStatus = "embedded";
        chunk.embeddingError = null;
        chunk.embeddedAt = new Date();
        chunk.vectorLabel = label;
        await chunk.save();
        embedded++;
      } catch (error) {
        await markChunkFailed(chunk, error instanceof Error ? error.message : "Embedding failed");
        failed++;
      }
    }
  }

  return { embedded, failed };
}

async function markChunkFailed(chunk: ChunkDoc, message: string): Promise<void> {
  chunk.embeddingStatus = "failed";
  chunk.embeddingError = message;
  await chunk.save();
}
