import "server-only";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { CURRENT_EMBEDDING_DIMENSION, CURRENT_EMBEDDING_MODEL } from "./constants";
import { parseEmbedOutput, type EmbedResult } from "./embed-result";

const PROCESSOR_DIR = path.join(process.cwd(), "processor");

function resolvePythonBin(): string {
  if (process.env.PROCESSOR_PYTHON_BIN) {
    return process.env.PROCESSOR_PYTHON_BIN;
  }
  const venvPython = path.join(PROCESSOR_DIR, ".venv", "bin", "python3");
  return existsSync(venvPython) ? venvPython : "python3";
}

export class EmbeddingProviderError extends Error {}

export interface EmbeddingBatch {
  model: string;
  dimension: number;
  vectors: number[][];
}

/**
 * The app-level embedding seam. Everything above this (the embedding
 * pipeline, RetrievalService) talks to this interface, never to a
 * specific model or a specific process boundary — so an
 * ExternalEmbeddingProvider (a hosted embedding API) could be added later
 * as another implementation without changing anything upstream.
 */
export interface EmbeddingProvider {
  embedDocuments(texts: string[]): Promise<EmbeddingBatch>;
  embedQuery(text: string): Promise<EmbeddingBatch>;
}

/**
 * Spawns the local Python embedding CLI (processor/processor/embed_cli.py)
 * — same subprocess-boundary pattern as study-materials/processor-runner.ts.
 * Texts go in as a JSON array on stdin (an argv string has length/escaping
 * limits that a batch of chunk texts would hit); one line of JSON comes
 * back on stdout.
 */
function runEmbedCli(mode: "documents" | "query", texts: string[]): Promise<EmbedResult> {
  return new Promise((resolve) => {
    const child = spawn(resolvePythonBin(), ["-m", "processor.embed_cli", "--mode", mode], {
      cwd: PROCESSOR_DIR,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    child.on("error", (error) => {
      resolve({ ok: false, error: `Failed to start embedding process: ${error.message}` });
    });

    child.on("close", () => {
      if (!stdout.trim()) {
        resolve({ ok: false, error: stderr.trim() || "Embedding process produced no output" });
        return;
      }
      resolve(parseEmbedOutput(stdout));
    });

    child.stdin.write(JSON.stringify(texts));
    child.stdin.end();
  });
}

/**
 * A vector produced by a different model than CURRENT_EMBEDDING_MODEL
 * expects must never be silently treated as compatible (wrong
 * dimensionality would corrupt the HNSW index; same dimensionality but a
 * different model would silently degrade retrieval quality). This is
 * checked against the CLI's own reported model/dimension, not assumed
 * from configuration, so a misconfigured PROCESSOR_PYTHON_BIN pointing at
 * a different environment fails loudly instead of drifting silently.
 */
function assertExpectedModel(result: EmbeddingBatch): void {
  if (result.model !== CURRENT_EMBEDDING_MODEL || result.dimension !== CURRENT_EMBEDDING_DIMENSION) {
    throw new EmbeddingProviderError(
      `Embedding process reported model "${result.model}" (dim ${result.dimension}), ` +
        `expected "${CURRENT_EMBEDDING_MODEL}" (dim ${CURRENT_EMBEDDING_DIMENSION})`,
    );
  }
}

export class LocalEmbeddingProvider implements EmbeddingProvider {
  async embedDocuments(texts: string[]): Promise<EmbeddingBatch> {
    const result = await runEmbedCli("documents", texts);
    if (!result.ok) throw new EmbeddingProviderError(result.error);
    const batch = { model: result.model, dimension: result.dimension, vectors: result.embeddings };
    assertExpectedModel(batch);
    return batch;
  }

  async embedQuery(text: string): Promise<EmbeddingBatch> {
    const result = await runEmbedCli("query", [text]);
    if (!result.ok) throw new EmbeddingProviderError(result.error);
    const batch = { model: result.model, dimension: result.dimension, vectors: result.embeddings };
    assertExpectedModel(batch);
    return batch;
  }
}

let defaultProvider: EmbeddingProvider | null = null;

/** Factory seam: swap the implementation here to add an ExternalEmbeddingProvider later. */
export function getEmbeddingProvider(): EmbeddingProvider {
  if (!defaultProvider) {
    defaultProvider = new LocalEmbeddingProvider();
  }
  return defaultProvider;
}
