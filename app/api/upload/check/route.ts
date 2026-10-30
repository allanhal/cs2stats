import { NextResponse } from "next/server";
import { SCHEMA_VERSION } from "@/lib/extract";
import { findByFileHash, findByFileName, setFileHash } from "@/lib/store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { hash, name, size } = (await request.json().catch(() => ({}))) as {
    hash?: string;
    name?: string;
    size?: number;
  };
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) {
    return NextResponse.json({ known: false });
  }

  const byHash = await findByFileHash(hash);
  if (byHash) {
    if (byHash.version < SCHEMA_VERSION) {
      return NextResponse.json({ known: false, outdated: true, matchId: byHash.id });
    }
    return NextResponse.json({ known: true, matchId: byHash.id, map: byHash.map });
  }

  if (name && typeof size === "number") {
    const byName = await findByFileName(name, size);
    if (byName) {
      if (!byName.hasHash) await setFileHash(byName.id, hash);
      if (byName.version < SCHEMA_VERSION) {
        return NextResponse.json({ known: false, outdated: true, matchId: byName.id });
      }
      return NextResponse.json({ known: true, matchId: byName.id, backfilled: !byName.hasHash });
    }
  }

  return NextResponse.json({ known: false });
}
