import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  experimental: {
    // Envoi des photos (déjà compressées en WebP dans le navigateur).
    serverActions: { bodySizeLimit: "4.5mb" },
  },
};

export default nextConfig;
