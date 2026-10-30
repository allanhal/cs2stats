import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { extractMatch } from "../lib/extract";
import { packingOf, unpackDemo } from "../lib/unpack";

async function main() {
  const file = process.argv[2];
  const uploadedBy = (process.argv[3] ?? "").slice(0, 60).trim() || "anônimo";
  if (!file) {
    throw new Error("uso: node cs2stats-extract.mjs <arquivo.dem> [nick]");
  }

  const fileName = path.basename(file);
  let workDir: string | null = null;
  let demoPath = file;

  try {
    if ((await packingOf(file)) !== "raw") {
      workDir = await mkdtemp(path.join(tmpdir(), "cs2stats-"));
      demoPath = await unpackDemo(file, path.join(workDir, "demo.dem"));
    }
    const match = extractMatch(demoPath, { fileName, uploadedBy });
    process.stdout.write(JSON.stringify(match));
  } finally {
    if (workDir) await rm(workDir, { recursive: true, force: true });
  }
}

main().catch((error) => {
  process.stderr.write(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
