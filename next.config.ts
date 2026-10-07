import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Without this, Next 16 + Turbopack picks the parent monorepo-style root
  // when worktrees are used and silently loads the wrong .env.local. Pin to
  // this directory so env loading is deterministic.
  turbopack: {
    root: __dirname,
  },
  // Users paste Meta tokens and access codes here: refuse to be framed
  // (clickjacking) and keep URLs out of outbound Referer headers.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
