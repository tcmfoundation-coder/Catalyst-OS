import "server-only";
import { existsSync } from "node:fs";
import path from "node:path";

/** Resolves the shared Python executable for extraction and embeddings. */
export function resolveProcessorPythonBin(): string {
  const configured = process.env.PROCESSOR_PYTHON_BIN?.trim();
  if (configured) {
    // Project .env values are relative to the app root, while both child
    // processes run with processor/ as their working directory.
    if (path.isAbsolute(configured)) return configured;
    if (configured.includes("/") || configured.includes("\\")) return path.resolve(process.cwd(), configured);
    return configured;
  }

  const candidates = process.platform === "win32"
    ? [path.join(process.cwd(), "processor", ".venv", "Scripts", "python.exe")]
    : [
        path.join(process.cwd(), "processor", ".venv", "bin", "python3"),
        path.join(process.cwd(), "processor", ".venv", "bin", "python"),
      ];
  return candidates.find(existsSync) ?? (process.platform === "win32" ? "python" : "python3");
}
