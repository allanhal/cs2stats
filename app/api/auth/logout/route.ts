import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { clearedPlayerCookie } from "@/lib/account";

export const runtime = "nodejs";

export async function POST() {
  (await cookies()).set(clearedPlayerCookie());
  return NextResponse.json({ ok: true });
}
