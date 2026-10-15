import "server-only";
import { spawn } from "node:child_process";
import path from "node:path";
import { parseProcessorOutput, type ProcessorResult } from "./processor-result";
import { resolveProcessorPythonBin } from "./python-runtime";
import type { MaterialFormat } from "./constants";

const PROCESSOR_DIR = path.join(process.cwd(), "processor");

/**
 * Spawns the Python document processor and waits for its single line of
 * JSON on stdout. This is the entire Next.js <-> Python boundary — see
 * processor/processor/cli.py's docstring for the contract. Swapping this
 * subprocess call for an HTTP request to a worker later wouldn't require
 * changing anything else that calls runDocumentProcessor().
 */
export function runDocumentProcessor(filePath: string, format: MaterialFormat): Promise<ProcessorResult> {
  return new Promise((resolve) => {
    const child = spawn(resolveProcessorPythonBin(), ["-m", "processor.cli", filePath, "--format", format], {
      cwd: PROCESSOR_DIR,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));

    child.on("error", (error) => {
      resolve({ ok: false, error: `Failed to start document processor: ${error.message}` });
    });

    child.on("close", () => {
      if (!stdout.trim()) {
        resolve({ ok: false, error: stderr.trim() || "Document processor produced no output" });
        return;
      }
      resolve(parseProcessorOutput(stdout));
    });
  });
}
