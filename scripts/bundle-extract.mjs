import { build } from "esbuild";

await build({
  entryPoints: ["scripts/extract-cli.ts"],
  outfile: "public/cs2stats-extract.mjs",
  bundle: true,
  format: "esm",
  platform: "node",
  target: "node20",
  external: ["@laihoe/demoparser2"],
  legalComments: "none",
  banner: {
    js: "import { createRequire as __createRequire } from 'node:module';\nconst require = __createRequire(import.meta.url);",
  },
  logLevel: "error",
});
