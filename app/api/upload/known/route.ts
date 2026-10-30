import { NextResponse } from "next/server";
import { SCHEMA_VERSION } from "@/lib/schema";
import { listMatches } from "@/lib/store";

export const runtime = "nodejs";

const MAX_IDS = 500;
const ID = /^\d{1,12}$/;

export async function POST(request: Request) {
  const { matchIds } = (await request.json().catch(() => ({}))) as { matchIds?: unknown };
  if (!Array.isArray(matchIds)) {
    return NextResponse.json({ error: "matchIds deve ser uma lista" }, { status: 400 });
  }

  const wanted = matchIds
    .filter((value): value is string => typeof value === "string" && ID.test(value))
    .slice(0, MAX_IDS);
  if (wanted.length === 0) return NextResponse.json({ known: {} });

  const matches = await listMatches();
  const known: Record<string, { matchId: string; version: number; outdated: boolean }> = {};

  for (const id of wanted) {
    const needle = `__${id}__`;
    const found = matches.find((match) => match.fileName.includes(needle));
    if (!found) continue;
    known[id] = {
      matchId: found.id,
      version: found.version,
      outdated: found.version < SCHEMA_VERSION,
    };
  }

  return NextResponse.json({ known });
}
