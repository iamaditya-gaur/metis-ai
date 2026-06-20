import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Next 16 + Turbopack picks the parent monorepo-style root
  // when worktrees are used and silently loads the wrong .env.local. Pin to
  // this directory so env loading is deterministic.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
