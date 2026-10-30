import { cookies } from "next/headers";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).delete("cs2stats_admin");
  return NextResponse.json({ ok: true });
}
