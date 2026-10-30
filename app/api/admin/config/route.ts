import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getConfig, saveConfig } from "@/lib/store";

const STEAM_ID = /^\d{17}$/;

const steamIds = (value: unknown): string[] | null =>
  Array.isArray(value)
    ? Array.from(
        new Set(value.filter((v): v is string => typeof v === "string" && STEAM_ID.test(v))),
      )
    : null;

const idMap = (value: unknown): Record<string, string> | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, target] of Object.entries(value as Record<string, unknown>)) {
    if (!STEAM_ID.test(key) || typeof target !== "string" || !STEAM_ID.test(target)) continue;
    if (key === target) continue;
    out[key] = target;
  }
  return out;
};

const nameMap = (value: unknown): Record<string, string> | null => {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return null;
  const out: Record<string, string> = {};
  for (const [key, name] of Object.entries(value as Record<string, unknown>)) {
    if (!STEAM_ID.test(key) || typeof name !== "string") continue;
    const trimmed = name.trim().slice(0, 40);
    if (trimmed.length > 0) out[key] = trimmed;
  }
  return out;
};

export async function POST(request: Request) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const current = await getConfig();

  const teamName =
    typeof body.teamName === "string" && body.teamName.trim().length > 0
      ? body.teamName.trim().slice(0, 40)
      : current.teamName;

  const config = {
    teamName,
    trackedSteamIds: steamIds(body.trackedSteamIds) ?? current.trackedSteamIds,
    hiddenSteamIds: steamIds(body.hiddenSteamIds) ?? current.hiddenSteamIds,
    aliases: idMap(body.aliases) ?? current.aliases,
    displayNames: nameMap(body.displayNames) ?? current.displayNames,
  };

  await saveConfig(config);
  return NextResponse.json({ ok: true, ...config });
}
