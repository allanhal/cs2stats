import { query } from "@/lib/db";

export interface Profile {
  persona: string;
  avatar: string;
}

export type Profiles = Record<string, Profile>;

const BATCH = 100;

export async function loadProfiles(): Promise<Profiles> {
  const rows = await query<{ steam_id: string; persona: string; avatar: string }>(
    "select steam_id, persona, avatar from steam_profiles",
  );
  const out: Profiles = {};
  for (const row of rows) out[row.steam_id] = { persona: row.persona, avatar: row.avatar };
  return out;
}

export async function fetchProfiles(steamIds: string[]): Promise<Profiles> {
  const key = process.env.STEAM_API_KEY;
  if (!key || steamIds.length === 0) return {};

  const out: Profiles = {};
  for (let i = 0; i < steamIds.length; i += BATCH) {
    const url = new URL("https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/");
    url.searchParams.set("key", key);
    url.searchParams.set("steamids", steamIds.slice(i, i + BATCH).join(","));

    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) continue;
    const data = (await response.json()) as {
      response?: {
        players?: { steamid: string; personaname?: string; avatarmedium?: string }[];
      };
    };
    for (const player of data.response?.players ?? []) {
      out[player.steamid] = {
        persona: player.personaname ?? "",
        avatar: player.avatarmedium ?? "",
      };
    }
  }
  return out;
}

export async function saveProfiles(profiles: Profiles): Promise<void> {
  for (const [steamId, profile] of Object.entries(profiles)) {
    await query(
      `insert into steam_profiles (steam_id, persona, avatar)
       values ($1, $2, $3)
       on conflict (steam_id) do update set
         persona = excluded.persona,
         avatar = excluded.avatar,
         fetched_at = now()`,
      [steamId, profile.persona, profile.avatar],
    );
  }
}

export async function refreshProfiles(
  steamIds: string[],
  { maxAgeHours = 24 * 7 }: { maxAgeHours?: number } = {},
): Promise<number> {
  if (steamIds.length === 0) return 0;

  const fresh = await query<{ steam_id: string }>(
    `select steam_id from steam_profiles
      where steam_id = any($1) and fetched_at > now() - ($2 || ' hours')::interval`,
    [steamIds, String(maxAgeHours)],
  );
  const known = new Set(fresh.map((row) => row.steam_id));
  const stale = steamIds.filter((id) => !known.has(id));
  if (stale.length === 0) return 0;

  const fetched = await fetchProfiles(stale);
  await saveProfiles(fetched);
  return Object.keys(fetched).length;
}
