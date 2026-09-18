import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // hnswlib-node ships a native (.node) addon — Next.js's default bundling
  // tries to process it like ordinary JS/TS and corrupts it. This is the
  // documented escape hatch (see serverExternalPackages.md): the package
  // is require()'d directly from node_modules at runtime instead.
  serverExternalPackages: ["hnswlib-node"],
};

export default nextConfig;
