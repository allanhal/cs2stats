import { createWriteStream } from "node:fs";
import { mkdtemp, open as openFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { ReadableStream as NodeWebReadableStream } from "node:stream/web";
import { NextResponse } from "next/server";
import { extractMatch } from "@/lib/extract";
import { acquireIngestLock, releaseIngestLock } from "@/lib/lock";
import { DEMO_PREFIX, discardDemo, readDemo } from "@/lib/objects";
import { refreshProfiles } from "@/lib/profiles";
import { demoFingerprint } from "@/lib/demo-hash";
import { unpackDemo } from "@/lib/unpack";
import {
  findByFileHash,
  findByFingerprint,
  fingerprintOf,
  replaceMatch,
  saveMatch,
} from "@/lib/store";

export const maxDuration = 300;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    pathname?: string;
    name?: string;
    by?: string;
  };
  const pathname = body.pathname ?? "";
  const fileName = (body.name ?? "demo.dem").slice(0, 200);
  const uploadedBy = (body.by ?? "").slice(0, 60).trim() || "anônimo";

  if (!pathname.startsWith(DEMO_PREFIX)) {
    return NextResponse.json({ error: "Referência de upload inválida" }, { status: 400 });
  }

  const lock = await acquireIngestLock();
  if (!lock) {
    return NextResponse.json(
      { error: "Outra demo está sendo processada agora", busy: true },
      { status: 429, headers: { "retry-after": "15" } },
    );
  }

  const dir = await mkdtemp(path.join(tmpdir(), "cs2stats-"));
  const incoming = path.join(dir, "incoming");
  let staged = false;

  try {
    const objeto = await readDemo(pathname);
    staged = true;
    await pipeline(
      Readable.fromWeb(objeto.stream as NodeWebReadableStream),
      createWriteStream(incoming),
    );

    const fileHash = await hashFile(incoming);
    const demoPath = await unpackDemo(incoming, path.join(dir, "upload.dem"));
    const match = extractMatch(demoPath, { fileName, uploadedBy });

    const stored =
      (await findByFileHash(fileHash)) ?? (await findByFingerprint(fingerprintOf(match)));

    if (stored) {
      if (match.version <= stored.version) {
        return NextResponse.json(
          { error: "Essa partida já foi enviada", matchId: stored.id, duplicate: true },
          { status: 409 },
        );
      }
      await replaceMatch(stored.id, {
        ...match,
        id: stored.id,
        uploadedAt: stored.uploadedAt,
        uploadedBy: stored.uploadedBy,
        fileName: stored.fileName,
      });
      await refreshProfiles(match.players.map((p) => p.steamId)).catch(() => {});
      return NextResponse.json({
        matchId: stored.id,
        map: match.map,
        rounds: match.totalRounds,
        score: match.score,
        players: match.players.length,
        playedAt: match.playedAt,
        updated: true,
      });
    }

    await saveMatch(match, fileHash);

    await refreshProfiles(match.players.map((p) => p.steamId)).catch(() => {});
    return NextResponse.json({
      matchId: match.id,
      map: match.map,
      rounds: match.totalRounds,
      score: match.score,
      players: match.players.length,
      playedAt: match.playedAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Falha ao processar a demo";
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    await Promise.allSettled([
      staged ? discardDemo(pathname) : Promise.resolve(),
      rm(dir, { recursive: true, force: true }),
      releaseIngestLock(lock),
    ]);
  }
}

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
