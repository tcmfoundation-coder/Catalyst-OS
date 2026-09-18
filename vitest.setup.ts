import { existsSync } from "node:fs";
import path from "node:path";

/**
 * Vitest (unlike Next.js) doesn't auto-load .env.local. A handful of
 * integration tests connect to the real local MongoDB the same way the
 * app does (see lib/db.ts's MONGODB_URI), so it needs to be loaded here
 * too. Uses Node's built-in loader — no dotenv dependency needed.
 */
const envLocalPath = path.resolve(import.meta.dirname, ".env.local");
if (existsSync(envLocalPath)) {
  process.loadEnvFile(envLocalPath);
}
