import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // Vite doesn't set the "react-server" export condition Next.js uses to
      // resolve "server-only" to its no-op branch, so under plain Vitest
      // resolution it would hit the throwing default export. Aliasing
      // straight to that same no-op file lets server-only-marked modules
      // (e.g. lib/retrieval/vector-index.ts) be unit tested directly.
      "server-only": path.resolve(import.meta.dirname, "./node_modules/server-only/empty.js"),
    },
  },
});
