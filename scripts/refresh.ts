import { open as openFile } from "node:fs/promises";
import { basename } from "node:path";
import { demoFingerprint } from "../lib/demo-hash";
import { extractMatch } from "../lib/extract";
import { getPool } from "../lib/db";
import { fingerprintOf, findByFileHash, findByFingerprint, replaceMatch } from "../lib/store";

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
    const fileName = basename(path);
    const match = extractMatch(path, { fileName, uploadedBy: "refresh" });
    const existing =
      (await findByFileHash(await hashFile(path))) ?? (await findByFingerprint(fingerprintOf(match)));

    if (!existing) {
      console.log(`não está no banco: ${fileName}`);
      continue;
    }

    await replaceMatch(existing.id, {
      ...match,
      id: existing.id,
      uploadedAt: existing.uploadedAt,
      uploadedBy: existing.uploadedBy,
      fileName: existing.fileName,
    });
    console.log(
      `atualizado: ${match.map} ${match.score.A}-${match.score.B} · versão ${existing.version} -> ${match.version} · ${existing.id}`,
    );
  }
  await getPool().end();
}
main().catch((e) => { console.error(e); process.exit(1); });
