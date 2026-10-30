import { query } from "./db";
import type { AppConfig, MatchRecord } from "./types";

const UUID = /^[a-f0-9-]{36}$/i;

export function fingerprintOf(m: MatchRecord): string {
  const roster = m.players
    .map((p) => p.steamId)
    .sort()
    .join(",");
  return `${m.map}|${m.totalRounds}|${m.score.A}-${m.score.B}|${roster}`;
}

export async function saveMatch(match: MatchRecord, fileHash: string | null = null): Promise<void> {
  await query(
    `insert into matches
       (id, version, played_at, uploaded_at, uploaded_by, file_name,
        file_size_bytes, map, total_rounds, fingerprint, record, file_hash)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
    [
      match.id,
      match.version,
      match.playedAt,
      match.uploadedAt,
      match.uploadedBy,
      match.fileName,
      match.fileSizeBytes,
      match.map,
      match.totalRounds,
      fingerprintOf(match),
      JSON.stringify(match),
      fileHash,
    ],
  );
}

export async function listMatches(): Promise<MatchRecord[]> {
  const rows = await query<{ record: MatchRecord }>(
    "select record from matches order by played_at desc",
  );
  return rows.map((r) => r.record);
}

export async function getMatch(id: string): Promise<MatchRecord | null> {
  if (!UUID.test(id)) return null;
  const rows = await query<{ record: MatchRecord }>(
    "select record from matches where id = $1",
    [id],
  );
  return rows[0]?.record ?? null;
}

export async function deleteMatch(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await query<{ id: string }>(
    "delete from matches where id = $1 returning id",
    [id],
  );
  return rows.length > 0;
}

export async function findByFileName(
  fileName: string,
  fileSizeBytes: number,
): Promise<{ id: string; hasHash: boolean; version: number } | null> {
  const rows = await query<{ id: string; file_hash: string | null; version: number }>(
    "select id, file_hash, version from matches where file_name = $1 and file_size_bytes = $2 limit 1",
    [fileName, fileSizeBytes],
  );
  return rows[0]
    ? { id: rows[0].id, hasHash: rows[0].file_hash !== null, version: rows[0].version }
    : null;
}

export async function setFileHash(id: string, fileHash: string): Promise<void> {
  await query("update matches set file_hash = $2 where id = $1 and file_hash is null", [
    id,
    fileHash,
  ]);
}

export async function replaceMatch(id: string, match: MatchRecord): Promise<void> {
  await query(
    `update matches set
       version = $2, played_at = $3, map = $4, total_rounds = $5,
       fingerprint = $6, record = $7
     where id = $1`,
    [
      id,
      match.version,
      match.playedAt,
      match.map,
      match.totalRounds,
      fingerprintOf(match),
      JSON.stringify(match),
    ],
  );
}

export async function findByFileHash(fileHash: string): Promise<MatchRecord | null> {
  const rows = await query<{ record: MatchRecord }>(
    "select record from matches where file_hash = $1 limit 1",
    [fileHash],
  );
  return rows[0]?.record ?? null;
}

export async function findByFingerprint(fingerprint: string): Promise<MatchRecord | null> {
  const rows = await query<{ record: MatchRecord }>(
    "select record from matches where fingerprint = $1",
    [fingerprint],
  );
  return rows[0]?.record ?? null;
}

export async function getConfig(): Promise<AppConfig> {
  const rows = await query<{
    team_name: string;
    tracked_steam_ids: string[];
    hidden_steam_ids: string[];
    aliases: Record<string, string>;
    display_names: Record<string, string>;
  }>(
    `select team_name, tracked_steam_ids, hidden_steam_ids, aliases, display_names
     from app_config where id = 1`,
  );
  const row = rows[0];
  return {
    teamName: row?.team_name ?? "Nosso time",
    trackedSteamIds: row?.tracked_steam_ids ?? [],
    hiddenSteamIds: row?.hidden_steam_ids ?? [],
    aliases: row?.aliases ?? {},
    displayNames: row?.display_names ?? {},
  };
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await query(
    `insert into app_config
       (id, team_name, tracked_steam_ids, hidden_steam_ids, aliases, display_names)
     values (1, $1, $2, $3, $4, $5)
     on conflict (id) do update
       set team_name = excluded.team_name,
           tracked_steam_ids = excluded.tracked_steam_ids,
           hidden_steam_ids = excluded.hidden_steam_ids,
           aliases = excluded.aliases,
           display_names = excluded.display_names`,
    [
      config.teamName,
      config.trackedSteamIds,
      config.hiddenSteamIds,
      JSON.stringify(config.aliases),
      JSON.stringify(config.displayNames),
    ],
  );
}
