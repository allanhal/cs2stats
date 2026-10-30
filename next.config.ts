import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@laihoe/demoparser2"],
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
