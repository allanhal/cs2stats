import { createWriteStream } from "node:fs";
import { open as openFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { demoFingerprint } from "./demo-hash";
import { requireEnv } from "./env";

export async function downloadTo(url: string, target: string): Promise<number> {
  const response = await fetch(url, { redirect: "manual" });
  if (response.status !== 200 || !response.body) {
    throw new Error(`demo indisponivel (${response.status})`);
  }
  await pipeline(Readable.fromWeb(response.body as never), createWriteStream(target));
  const handle = await openFile(target, "r");
  try {
    return (await handle.stat()).size;
  } finally {
    await handle.close();
  }
}

export async function fingerprintOfFile(filePath: string): Promise<string> {
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

export async function sendRecord(record: unknown, hash: string): Promise<string> {
  const site = requireEnv("CS2STATS_URL").replace(/\/$/, "");
  const response = await fetch(`${site}/api/matches`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ record, hash }),
  });
  const body = (await response.json().catch(() => ({}))) as {
    matchId?: string;
    duplicate?: boolean;
    error?: string;
  };
  if (response.status === 409 && body.duplicate) return "duplicada";
  if (!response.ok) throw new Error(body.error ?? `POST /api/matches respondeu ${response.status}`);
  return body.matchId ?? "enviada";
}

export function pause(minMs: number, maxMs: number): Promise<void> {
  const span = Math.max(0, maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.random() * span));
}
