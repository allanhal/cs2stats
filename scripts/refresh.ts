import { open as openFile, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { tmpdir } from "node:os";
import { demoFingerprint } from "../lib/demo-hash";
import { extractMatch } from "../lib/extract";
import { getPool } from "../lib/db";
import { fingerprintOf, findByFileHash, findByFingerprint, replaceMatch } from "../lib/store";
import { unpackDemo } from "../lib/unpack";

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

async function refreshOne(path: string): Promise<void> {
  const fileName = basename(path);
  const unpacked = join(tmpdir(), `refresh-${process.pid}-${Date.now()}.dem`);
  const demo = await unpackDemo(path, unpacked);

  try {
    const match = extractMatch(demo, { fileName, uploadedBy: "refresh" });
    const existing =
      (await findByFileHash(await hashFile(path))) ?? (await findByFingerprint(fingerprintOf(match)));

    if (!existing) {
      console.log(`não está no banco: ${fileName}`);
      return;
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
  } finally {
    if (demo !== path) await rm(demo, { force: true });
  }
}

async function main() {
  let failed = 0;
  for (const path of process.argv.slice(2)) {
    try {
      await refreshOne(path);
    } catch (error) {
      failed += 1;
      console.error(`falhou: ${basename(path)} · ${(error as Error).message}`);
    }
  }
  if (failed > 0) console.error(`${failed} arquivo(s) não puderam ser lidos`);
  await getPool().end();
}
main().catch((e) => { console.error(e); process.exit(1); });
