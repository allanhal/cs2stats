import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { adminCookie, checkPassword } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const { password } = (await request.json().catch(() => ({}))) as { password?: string };
  if (!password || !checkPassword(password)) {
    return NextResponse.json({ error: "Senha incorreta" }, { status: 401 });
  }
  (await cookies()).set(adminCookie());
  return NextResponse.json({ ok: true });
}
