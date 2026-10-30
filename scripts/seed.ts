import { open as openFile } from "node:fs/promises";
import { basename } from "node:path";
import { demoFingerprint } from "../lib/demo-hash";
import { extractMatch } from "../lib/extract";
import { getPool } from "../lib/db";
import { fingerprintOf, findByFileHash, findByFingerprint, listMatches, saveMatch } from "../lib/store";

async function hashFile(filePath: string): Promise<string> {
  const handle = await openFile(filePath, "r");
  try {
    const { size } = await handle.stat();
    return await demoFingerprint(size, async (start, end) => {
      const buffer = Buffer.alloc(end - start);
      await handle.read(buffer, 0, buffer.length, start);
      return new Uint8Array(buffer);
    });
  } finally {
    await handle.close();
  }
}

async function main() {
  for (const path of process.argv.slice(2)) {
    const fileHash = await hashFile(path);
    const sameFile = await findByFileHash(fileHash);
    if (sameFile) {
      console.log(`já existe: ${basename(path)}`);
      continue;
    }

    const match = extractMatch(path, { fileName: basename(path), uploadedBy: "seed" });
    const dup = await findByFingerprint(fingerprintOf(match));
    if (dup) {
      console.log(`já existe: ${match.map} (${match.id === dup.id ? "" : "dup de " + dup.id})`);
      continue;
    }
    await saveMatch(match, fileHash);
    console.log(
      `gravado: ${match.map} ${match.teamLabel.A} ${match.score.A}-${match.score.B} ${match.teamLabel.B} · ${match.totalRounds} rounds · ${match.playedAt.slice(0,10)}`,
    );
  }
  console.log("total no banco:", (await listMatches()).length);
  await getPool().end();
}
main().catch((e) => { console.error(e); process.exit(1); });
