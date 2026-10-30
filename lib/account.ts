import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";
import { getSteamUser, type SteamUser } from "@/lib/steam-users";

export { getSteamUser, upsertSteamUser, type SteamUser } from "@/lib/steam-users";

const COOKIE = "cs2stats_player";
const sign = (steamId: string) =>
  createHmac("sha256", requireEnv("ADMIN_SECRET")).update(`player:${steamId}`).digest("hex");

export const playerCookie = (steamId: string) => ({
  name: COOKIE,
  value: `${steamId}.${sign(steamId)}`,
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: 60 * 60 * 24 * 90,
});

export const clearedPlayerCookie = () => ({ ...playerCookie(""), value: "", maxAge: 0 });

export async function currentSteamId(): Promise<string | null> {
  const raw = (await cookies()).get(COOKIE)?.value ?? "";
  const [steamId, signature] = raw.split(".");
  if (!steamId || !signature) return null;

  const a = Buffer.from(signature);
  const b = Buffer.from(sign(steamId));
  return a.length === b.length && timingSafeEqual(a, b) ? steamId : null;
}

export async function currentUser(): Promise<SteamUser | null> {
  const steamId = await currentSteamId();
  return steamId ? getSteamUser(steamId) : null;
}
