import { query } from "@/lib/db";

export interface SteamUser {
  steamId: string;
  persona: string;
  avatar: string;
}

interface Row extends Record<string, unknown> {
  steam_id: string;
  persona: string;
  avatar: string;
}

const toUser = (row: Row): SteamUser => ({
  steamId: row.steam_id,
  persona: row.persona,
  avatar: row.avatar,
});

export async function upsertSteamUser(
  steamId: string,
  profile: { persona: string; avatar: string },
): Promise<void> {
  await query(
    `insert into steam_users (steam_id, persona, avatar)
     values ($1, $2, $3)
     on conflict (steam_id) do update set
       persona = coalesce(nullif(excluded.persona, ''), steam_users.persona),
       avatar = coalesce(nullif(excluded.avatar, ''), steam_users.avatar),
       last_seen_at = now()`,
    [steamId, profile.persona, profile.avatar],
  );
}

export async function getSteamUser(steamId: string): Promise<SteamUser | null> {
  const rows = await query<Row>(
    "select steam_id, persona, avatar from steam_users where steam_id = $1",
    [steamId],
  );
  return rows[0] ? toUser(rows[0]) : null;
}
