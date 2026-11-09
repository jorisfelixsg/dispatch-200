import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Dev only: lets other local profiles run on http://bob.localhost:3000 etc. (separate localStorage).
  allowedDevOrigins: ["*.localhost"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
