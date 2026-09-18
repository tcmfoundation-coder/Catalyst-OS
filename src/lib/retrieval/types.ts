/** The safe, public projection of a MaterialChunk — no embedding vector, no userId. */
export interface RetrievedChunk {
  id: string;
  materialId: string;
  courseId: string | null;
  chunkIndex: number;
  text: string;
  heading: string | null;
  pageStart: number | null;
  pageEnd: number | null;
  slideStart: number | null;
  slideEnd: number | null;
}

export interface RetrievalSource {
  materialId: string;
  page: number | null;
  slide: number | null;
  heading: string | null;
}

export interface RetrievalHit {
  chunk: RetrievedChunk;
  score: number;
  source: RetrievalSource;
}

export interface RetrievalFilter {
  materialId?: string;
  courseId?: string;
  semesterId?: string;
}

export interface SearchOptions {
  topK?: number;
  minScore?: number;
  filter?: RetrievalFilter;
}
