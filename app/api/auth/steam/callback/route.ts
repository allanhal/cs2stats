import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { playerCookie, upsertSteamUser } from "@/lib/account";
import { fetchPersona, verifySignIn } from "@/lib/steam";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const steamId = await verifySignIn(url.searchParams);
  if (!steamId) {
    return NextResponse.redirect(new URL("/conta?erro=login", url.origin));
  }

  await upsertSteamUser(steamId, await fetchPersona(steamId));
  (await cookies()).set(playerCookie(steamId));
  return NextResponse.redirect(new URL("/conta", url.origin));
}
