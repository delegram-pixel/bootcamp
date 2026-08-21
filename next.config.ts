import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite (dev-only local Postgres) ships a WASM blob + .data file it loads
  // from its own dist directory at runtime. Bundling it breaks that path
  // resolution, so keep it external and let Node require it from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
};

export default nextConfig;
