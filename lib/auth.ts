import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { requireEnv } from "@/lib/env";

const COOKIE = "cs2stats_admin";
const tokenFor = (password: string) =>
  createHmac("sha256", requireEnv("ADMIN_SECRET")).update(password).digest("hex");

const adminToken = () => tokenFor(requireEnv("ADMIN_PASSWORD"));

export function checkPassword(input: string): boolean {
  const a = Buffer.from(tokenFor(input));
  const b = Buffer.from(adminToken());
  return a.length === b.length && timingSafeEqual(a, b);
}

export const adminCookie = () => ({
  name: COOKIE,
  value: adminToken(),
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
});

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return store.get(COOKIE)?.value === adminToken();
}
