import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshProfiles } from "@/lib/profiles";
import {
  findByFileHash,
  findByFingerprint,
  fingerprintOf,
  replaceMatch,
  saveMatch,
  setFileHash,
} from "@/lib/store";
import type { MatchRecord } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HASH = /^[0-9a-f]{64}$/;
const MAX_ROUNDS = 200;
const MAX_PLAYERS = 64;

function validate(value: unknown): MatchRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Partial<MatchRecord>;

  if (typeof record.map !== "string" || record.map.length === 0) return null;
  if (typeof record.version !== "number") return null;
  if (typeof record.totalRounds !== "number") return null;
  if (record.totalRounds < 0 || record.totalRounds > MAX_ROUNDS) return null;
  if (!Array.isArray(record.players) || record.players.length === 0) return null;
  if (record.players.length > MAX_PLAYERS) return null;
  if (!Array.isArray(record.rounds)) return null;
  if (record.rounds.length > MAX_ROUNDS) return null;
  if (typeof record.score !== "object" || record.score === null) return null;
  if (typeof record.score.A !== "number" || typeof record.score.B !== "number") return null;
  if (typeof record.playedAt !== "string" || Number.isNaN(Date.parse(record.playedAt))) {
    return null;
  }
  for (const player of record.players) {
    if (typeof player?.steamId !== "string" || !/^\d{5,20}$/.test(player.steamId)) return null;
  }

  return {
    ...(record as MatchRecord),
    id: typeof record.id === "string" && UUID.test(record.id) ? record.id : randomUUID(),
    uploadedAt: new Date().toISOString(),
    uploadedBy: String(record.uploadedBy ?? "").slice(0, 60).trim() || "anônimo",
    fileName: String(record.fileName ?? "demo.dem").slice(0, 200),
  };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as {
    record?: unknown;
    hash?: string;
  } | null;

  const match = validate(body?.record);
  if (!match) {
    return NextResponse.json({ error: "Partida em formato inválido" }, { status: 400 });
  }

  const hash = typeof body?.hash === "string" && HASH.test(body.hash) ? body.hash : null;

  const stored =
    (hash ? await findByFileHash(hash) : null) ?? (await findByFingerprint(fingerprintOf(match)));

  if (stored) {
    if (match.version <= stored.version) {
      return NextResponse.json(
        { error: "Essa partida já foi enviada", matchId: stored.id, duplicate: true },
        { status: 409 },
      );
    }
    if (hash) await setFileHash(stored.id, hash);
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

  await saveMatch(match, hash);
  await refreshProfiles(match.players.map((p) => p.steamId)).catch(() => {});

  return NextResponse.json({
    matchId: match.id,
    map: match.map,
    rounds: match.totalRounds,
    score: match.score,
    players: match.players.length,
    playedAt: match.playedAt,
  });
}
