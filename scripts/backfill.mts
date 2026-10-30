import { createWriteStream } from "node:fs";
import { mkdtemp, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import type { ReadableStream as WebReadableStream } from "node:stream/web";
import { pipeline } from "node:stream/promises";
import { getPool } from "../lib/db";
import { refreshOne } from "./refresh";

interface ArchiveFile {
  id: string;
  name: string;
  size: number;
}

const archive = (process.env.DEMO_ARCHIVE_URL ?? "https://public.allanpinheiro.com").replace(
  /\/$/,
  "",
);

async function index(): Promise<ArchiveFile[]> {
  const response = await fetch(`${archive}/api/files`);
  if (!response.ok) throw new Error(`o acervo respondeu ${response.status}`);
  const body = (await response.json()) as { files?: ArchiveFile[] };
  return (body.files ?? []).filter((file) => file.name.endsWith(".dem"));
}

async function localCopies(folders: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (const folder of folders) {
    let names: string[] = [];
    try {
      names = await readdir(folder);
    } catch {
      continue;
    }
    for (const name of names) {
      if (name.endsWith(".dem") && !found.has(name)) found.set(name, join(folder, name));
    }
  }
  return found;
}

async function download(file: ArchiveFile, into: string): Promise<string> {
  const target = join(into, file.name);
  const response = await fetch(`${archive}/api/files/${file.id}/download`);
  if (!response.ok || !response.body) throw new Error(`download falhou (${response.status})`);
  await pipeline(Readable.fromWeb(response.body as unknown as WebReadableStream<Uint8Array>), createWriteStream(target));
  const written = await stat(target);
  if (written.size !== file.size) throw new Error(`baixou ${written.size} de ${file.size} bytes`);
  return target;
}

function human(bytes: number): string {
  return `${(bytes / 1e9).toFixed(1)} GB`;
}

async function main() {
  const folders = process.argv.slice(2);
  if (folders.length === 0) folders.push(join(process.env.HOME ?? "", "Downloads"));
  const files = await index();
  const local = await localCopies(folders);
  const work = join(await mkdtemp(join(tmpdir(), "cs2stats-backfill-")));
  const pending = files.filter((file) => !local.has(file.name));

  console.log(
    `${files.length} demo(s) no acervo; ${files.length - pending.length} já estão aqui, ${pending.length} para baixar (${human(pending.reduce((total, file) => total + file.size, 0))})`,
  );

  let done = 0;
  let failed = 0;
  try {
    for (const [position, file] of files.entries()) {
      const prefix = `[${position + 1}/${files.length}] ${file.name}`;
      let path = local.get(file.name) ?? "";
      try {
        if (!path) {
          console.log(`${prefix}: baixando ${human(file.size)}...`);
          path = await download(file, work);
        }
        await refreshOne(path);
        done += 1;
      } catch (error) {
        failed += 1;
        console.error(`${prefix}: ${(error as Error).message}`);
      } finally {
        if (path.startsWith(work)) await rm(path, { force: true });
      }
    }
  } finally {
    await rm(work, { recursive: true, force: true });
    await getPool().end();
  }

  console.log(`${done} partida(s) refeita(s), ${failed} falha(s)`);
  process.exitCode = failed > 0 ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
