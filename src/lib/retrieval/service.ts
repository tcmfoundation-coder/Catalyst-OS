import "server-only";
import { connectToDatabase } from "@/lib/db";
import { CURRENT_EMBEDDING_MODEL } from "@/lib/embeddings/constants";
import { getEmbeddingProvider } from "@/lib/embeddings/provider";
import { Course } from "@/models/Course";
import { MaterialChunk } from "@/models/MaterialChunk";
import { searchVectorIndex } from "./index-manager";
import type { RetrievalFilter, RetrievalHit, SearchOptions } from "./types";
import type { VectorOwner, VectorSearchHit } from "./vector-index";

/**
 * The sole app-level entry point for semantic retrieval. Nothing else in
 * the app should call index-manager.ts or vector-index.ts directly to
 * read search results — this is where embedding the query, applying
 * ownership/metadata filtering, thresholding, and resolving back to
 * MongoDB all happen.
 */

const DEFAULT_TOP_K = 5;
// Sentence embeddings from the same domain but on an unrelated topic can
// still score surprisingly high (empirically ~0.6 for e.g. "photosynthesis"
// vs. "mitochondria" queries/passages with this model), while genuinely
// unrelated pairs land around 0.3-0.4. There's no clean score threshold
// that reliably separates "relevant" from "not," so this is a loose floor
// against near-zero/noise matches, not a precision relevance cutoff —
// ranking by topK is what actually surfaces the best matches.
const DEFAULT_MIN_SCORE = 0.3;
// Over-fetch from the vector index, since some native-filter hits get
// dropped afterward (below the score floor, or the MongoDB record having
// since been deleted or gone stale) — without this, a topK=5 request
// could silently return fewer than 5 hits even when more exist.
const CANDIDATE_MULTIPLIER = 4;

async function resolveCourseIdsForSemester(userId: string, semesterId: string): Promise<string[]> {
  const courses = await Course.find({ semesterId, userId }).select("_id").lean();
  return courses.map((course) => course._id.toString());
}

export function buildOwnershipFilter(
  userId: string,
  filter: RetrievalFilter | undefined,
  semesterCourseIds: string[] | null,
): (owner: VectorOwner) => boolean {
  return (owner: VectorOwner): boolean => {
    // Ownership is enforced unconditionally, independent of anything the
    // caller passed in `filter` — a materialId/courseId/semesterId filter
    // only ever narrows a search that is already scoped to this user, it
    // can never widen it to another user's chunks.
    if (owner.userId !== userId) return false;
    if (filter?.materialId && owner.materialId !== filter.materialId) return false;
    if (filter?.courseId && owner.courseId !== filter.courseId) return false;
    if (semesterCourseIds && (!owner.courseId || !semesterCourseIds.includes(owner.courseId))) return false;
    return true;
  };
}

function toRetrievedChunk(chunk: {
  _id: { toString(): string };
  materialId: { toString(): string };
  courseId: { toString(): string } | null;
  chunkIndex: number;
  text: string;
  heading: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  slideStart: number | null;
  slideEnd: number | null;
}) {
  return {
    id: chunk._id.toString(),
    materialId: chunk.materialId.toString(),
    courseId: chunk.courseId ? chunk.courseId.toString() : null,
    chunkIndex: chunk.chunkIndex,
    text: chunk.text,
    heading: chunk.heading,
    pageStart: chunk.pageStart,
    pageEnd: chunk.pageEnd,
    slideStart: chunk.slideStart,
    slideEnd: chunk.slideEnd,
  };
}

async function resolveHits(userId: string, hits: VectorSearchHit[], topK: number): Promise<RetrievalHit[]> {
  if (hits.length === 0) return [];

  const scoreByLabel = new Map(hits.map((hit) => [hit.label, hit.score]));

  // This MongoDB query is the final, always-enforced ownership check —
  // "defense in depth" on top of the native HNSW filter above. It also
  // doubles as the safety net for every other way a label can go stale:
  // embeddingStatus/embeddingModel must still say "currently embedded,
  // current model" (a chunk that was deleted, re-embedded elsewhere, or
  // made stale by a model change no longer matches), and a label with no
  // matching document at all (deleted between the index search and this
  // query) simply isn't in the result set. Any of those cases means the
  // hit is silently dropped, never surfaced as a phantom or wrong-owner
  // result.
  const chunks = await MaterialChunk.find({
    vectorLabel: { $in: hits.map((hit) => hit.label) },
    userId,
    embeddingStatus: "embedded",
    embeddingModel: CURRENT_EMBEDDING_MODEL,
  }).lean();

  return chunks
    .map((chunk) => ({
      chunk: toRetrievedChunk(chunk),
      score: scoreByLabel.get(chunk.vectorLabel as number) ?? 0,
      source: {
        materialId: chunk.materialId.toString(),
        page: chunk.pageStart,
        slide: chunk.slideStart,
        heading: chunk.heading,
      },
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Embeds `queryText`, searches the persistent HNSW index for the topK
 * most semantically similar chunks this user owns (optionally narrowed
 * by materialId/courseId/semesterId), and resolves the hits back to
 * MongoDB. Never throws for "no results" — an empty query, a filter that
 * matches nothing, or a search with no hits above the score floor all
 * just return an empty array.
 */
export async function search(userId: string, queryText: string, options: SearchOptions = {}): Promise<RetrievalHit[]> {
  const trimmedQuery = queryText.trim();
  if (!trimmedQuery) return [];

  const topK = options.topK ?? DEFAULT_TOP_K;
  const minScore = options.minScore ?? DEFAULT_MIN_SCORE;

  await connectToDatabase();

  let semesterCourseIds: string[] | null = null;
  if (options.filter?.semesterId) {
    semesterCourseIds = await resolveCourseIdsForSemester(userId, options.filter.semesterId);
    if (semesterCourseIds.length === 0) return []; // nothing in this semester to search
  }

  const provider = getEmbeddingProvider();
  const { vectors } = await provider.embedQuery(trimmedQuery);
  const [queryVector] = vectors;

  const ownershipFilter = buildOwnershipFilter(userId, options.filter, semesterCourseIds);
  const candidates = await searchVectorIndex(queryVector, topK * CANDIDATE_MULTIPLIER, ownershipFilter);
  const aboveThreshold = candidates.filter((hit) => hit.score >= minScore);
  if (aboveThreshold.length === 0) return [];

  return resolveHits(userId, aboveThreshold, topK);
}
