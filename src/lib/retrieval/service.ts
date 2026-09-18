import "server-only";
import { Types } from "mongoose";
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
export interface MaterialCoverageOptions {
  maxChunks?: number;
  maxCharacters?: number;
}

/**
 * Coverage retrieval for a single material, for generators (Study Notes,
 * and later flashcards/quizzes) that need breadth across a document rather
 * than the best matches to one semantic query — a Tutor question has a
 * clear query to embed and rank against; "cover this material" doesn't.
 * This is a plain ownership-scoped MongoDB query in the material's own
 * chunkIndex order, bounded by chunk count and character budget — not a
 * second vector-search system, and not an unbounded dump. It also doesn't
 * depend on embedding having succeeded (unlike search()): chunks exist and
 * carry their extracted text before embedding ever runs (see
 * study-materials/processing.ts), so a material can be "covered" the
 * moment it's "ready", regardless of embedding status.
 */
export async function getMaterialCoverage(
  userId: string,
  materialId: string,
  options: MaterialCoverageOptions = {},
): Promise<RetrievalHit[]> {
  if (!Types.ObjectId.isValid(materialId)) return [];

  await connectToDatabase();

  const maxChunks = options.maxChunks ?? 12;
  const maxCharacters = options.maxCharacters ?? 10000;

  const chunks = await MaterialChunk.find({ materialId, userId }).sort({ chunkIndex: 1 }).lean();

  const hits: RetrievalHit[] = [];
  let totalChars = 0;
  for (const chunk of chunks) {
    if (hits.length >= maxChunks) break;
    // Same "always keep at least one, never add a second past budget" rule
    // ContextAssembler itself applies — see that file's comment.
    if (hits.length > 0 && totalChars + chunk.text.length > maxCharacters) break;

    hits.push({
      chunk: toRetrievedChunk(chunk),
      // Coverage hits aren't ranked by similarity — there's no query to
      // score against — so every hit gets the same score. It's never
      // shown to the user (see lib/study-resources' source handling) and
      // exists only because RetrievalHit's shape requires one; document
      // order (chunkIndex) is preserved by JS's stable sort in
      // ContextAssembler.build() when every score ties.
      score: 1,
      source: {
        materialId: chunk.materialId.toString(),
        page: chunk.pageStart,
        slide: chunk.slideStart,
        heading: chunk.heading,
      },
    });
    totalChars += chunk.text.length;
  }

  return hits;
}

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
