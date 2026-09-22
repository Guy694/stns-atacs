import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Docker image (ignored by Vercel).
  output: "standalone",
  // Tiny QR stickers encode the URL in upper case (smaller QR); the short path is matched case-sensitively.
  async rewrites() {
    return [{ source: "/Q/:id(\\d+)", destination: "/q/:id" }];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
