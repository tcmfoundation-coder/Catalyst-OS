/**
 * The single source of truth for "which embedding model is currently
 * configured." MaterialChunk.embeddingModel is compared against this to
 * derive staleness (same pattern as the "overdue" derived property on
 * Task — never stored as its own boolean, always computed against the
 * current value). Changing this constant is a deliberate model migration:
 * every existing chunk becomes stale and needs re-embedding + re-indexing
 * via the backfill path, not a routine config tweak.
 *
 * See processor/processor/embedding/provider.py for why this exact model
 * was chosen (MIT-licensed, 384-dim, retrieval-tuned, ~67MB quantized
 * ONNX weights, CPU-only inference).
 */
export const CURRENT_EMBEDDING_MODEL = "BAAI/bge-small-en-v1.5";
export const CURRENT_EMBEDDING_DIMENSION = 384;

export const EMBEDDING_STATUSES = ["pending", "embedded", "failed"] as const;
export type EmbeddingStatus = (typeof EMBEDDING_STATUSES)[number];
