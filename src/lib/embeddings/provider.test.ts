import { describe, expect, it } from "vitest";
import { CURRENT_EMBEDDING_DIMENSION, CURRENT_EMBEDDING_MODEL } from "./constants";
import { EmbeddingProviderError, LocalEmbeddingProvider } from "./provider";

/**
 * These spawn the real Python embedding CLI against the real cached
 * local model (see processor/README.md) — no mocks. Mirrors how
 * study-materials/processor-runner.ts is verified end-to-end rather than
 * with a mocked child_process.
 */
describe("LocalEmbeddingProvider", () => {
  it("embeds documents with the expected model and dimension", async () => {
    const provider = new LocalEmbeddingProvider();
    const result = await provider.embedDocuments(["First chunk.", "A second, different chunk."]);

    expect(result.model).toBe(CURRENT_EMBEDDING_MODEL);
    expect(result.dimension).toBe(CURRENT_EMBEDDING_DIMENSION);
    expect(result.vectors).toHaveLength(2);
    expect(result.vectors[0]).toHaveLength(CURRENT_EMBEDDING_DIMENSION);
  }, 30000);

  it("embeds a query and matches a semantically relevant chunk over an unrelated one", async () => {
    const provider = new LocalEmbeddingProvider();

    const { vectors: docs } = await provider.embedDocuments([
      "RAM is volatile memory and loses stored information when power is removed.",
      "The French Revolution began in 1789 and reshaped European politics.",
    ]);
    const { vectors: queryVectors } = await provider.embedQuery(
      "What happens to memory when electricity is switched off?",
    );

    const cosine = (a: number[], b: number[]) => {
      const dot = a.reduce((sum, x, i) => sum + x * b[i], 0);
      const normA = Math.sqrt(a.reduce((sum, x) => sum + x * x, 0));
      const normB = Math.sqrt(b.reduce((sum, x) => sum + x * x, 0));
      return dot / (normA * normB);
    };

    const query = queryVectors[0];
    const simRelevant = cosine(query, docs[0]);
    const simUnrelated = cosine(query, docs[1]);

    expect(simRelevant).toBeGreaterThan(simUnrelated);
  }, 30000);

  it("throws EmbeddingProviderError for an empty batch instead of returning a fake result", async () => {
    const provider = new LocalEmbeddingProvider();
    await expect(provider.embedDocuments([])).rejects.toThrow(EmbeddingProviderError);
  }, 30000);

  it("throws EmbeddingProviderError when the configured python binary doesn't exist", async () => {
    const original = process.env.PROCESSOR_PYTHON_BIN;
    process.env.PROCESSOR_PYTHON_BIN = "/nonexistent/python3";
    try {
      const provider = new LocalEmbeddingProvider();
      await expect(provider.embedDocuments(["text"])).rejects.toThrow(EmbeddingProviderError);
    } finally {
      if (original === undefined) delete process.env.PROCESSOR_PYTHON_BIN;
      else process.env.PROCESSOR_PYTHON_BIN = original;
    }
  }, 30000);
});
