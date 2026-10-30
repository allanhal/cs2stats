import zlib from "node:zlib";
import { unstable_cache } from "next/cache";
import { purgeCache } from "./purge";
import { readQuery, writeQuery } from "./db";
import type { AppConfig, MatchRecord, PlayerMatchStats } from "./types";
import type { Profiles } from "./profiles";

const UUID = /^[a-f0-9-]{36}$/i;
const CACHE_ENTRY_LIMIT = 2 * 1024 * 1024;

const pack = (value: unknown): Buffer => zlib.gzipSync(Buffer.from(JSON.stringify(value), "utf8"));

const unpack = <T>(data: Buffer): T => JSON.parse(zlib.gunzipSync(data).toString("utf8")) as T;

const fromBase64 = (value: string): Buffer => Buffer.from(value, "base64");

const fullSize = (avatar: string) => avatar.replace(/_(medium|full)?\.jpg$/, "_full.jpg");

export interface StoredMatch {
  id: string;
  version: number;
  map: string;
  uploadedAt: string;
  uploadedBy: string;
  fileName: string;
}

interface StoredMatchRow extends Record<string, unknown> {
  id: string;
  version: number;
  map: string;
  uploaded_at: Date;
  uploaded_by: string;
  file_name: string;
}

const storedMatch = (row: StoredMatchRow): StoredMatch => ({
  id: row.id,
  version: row.version,
  map: row.map,
  uploadedAt: new Date(row.uploaded_at).toISOString(),
  uploadedBy: row.uploaded_by,
  fileName: row.file_name,
});

const STORED_COLUMNS = "id, version, map, uploaded_at, uploaded_by, file_name";

export function fingerprintOf(m: MatchRecord): string {
  const roster = m.players
    .map((p) => p.steamId)
    .sort()
    .join(",");
  return `${m.map}|${m.totalRounds}|${m.score.A}-${m.score.B}|${roster}`;
}

function splitHeatmaps(match: MatchRecord): {
  record: MatchRecord;
  heatmaps: Map<string, Record<string, number>>;
} {
  const heatmaps = new Map<string, Record<string, number>>();
  const players = match.players.map((player) => {
    const { heatmap, ...rest } = player;
    if (heatmap && Object.keys(heatmap).length > 0) heatmaps.set(player.steamId, heatmap);
    return rest as PlayerMatchStats;
  });
  return { record: { ...match, players }, heatmaps };
}

async function saveHeatmaps(
  matchId: string,
  heatmaps: Map<string, Record<string, number>>,
): Promise<void> {
  await writeQuery("delete from match_heatmaps where match_id = $1", [matchId]);
  const entries = Array.from(heatmaps.entries());
  if (entries.length === 0) return;

  const values = entries.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(", ");
  await writeQuery(
    `insert into match_heatmaps (match_id, steam_id, heatmap) values ${values}`,
    [matchId, ...entries.flatMap(([steamId, heatmap]) => [steamId, pack(heatmap)])],
  );
}

async function readHeatmaps(steamIds: string[]): Promise<Record<string, number>> {
  const rows = await readQuery<{ map: string; heatmap: string }>(
    `select m.map, encode(h.heatmap, 'base64') as heatmap
       from match_heatmaps h
       join matches m on m.id = h.match_id
      where h.steam_id = any($1)`,
    [steamIds],
  );

  const out: Record<string, number> = {};
  for (const row of rows) {
    for (const [cell, seconds] of Object.entries(
      unpack<Record<string, number>>(fromBase64(row.heatmap)),
    )) {
      const key = `${row.map}|${cell}`;
      out[key] = (out[key] ?? 0) + seconds;
    }
  }
  return out;
}

const cachedHeatmaps = unstable_cache(
  async (_revision: number, steamIds: string[]) => readHeatmaps(steamIds),
  ["cs2stats", "heatmaps"],
  { revalidate: false },
);

export async function heatmapFor(steamIds: string[]): Promise<Record<string, number>> {
  if (steamIds.length === 0) return {};
  const key = [...steamIds].sort();
  const revision = await currentRevision();
  try {
    return await cachedHeatmaps(revision, key);
  } catch {
    return readHeatmaps(key);
  }
}

interface Snapshot {
  matches: MatchRecord[];
  config: AppConfig;
  profiles: Profiles;
}

let snapshot: { revision: number; data: Promise<Snapshot> } | null = null;

async function currentRevision(): Promise<number> {
  const rows = await readQuery<{ revision: string }>(
    "select revision from app_config where id = 1",
  );
  return Number(rows[0]?.revision ?? 0);
}

async function bumpRevision(): Promise<void> {
  snapshot = null;
  await writeQuery("update app_config set revision = revision + 1 where id = 1");
  await purgeCache();
}

async function readSnapshot(): Promise<Snapshot> {
  const [matches, config, profiles] = await Promise.all([
    readQuery<{ record: string }>(
      "select encode(record, 'base64') as record from matches order by played_at desc",
    ),
    readQuery<{
      team_name: string;
      tracked_steam_ids: string[];
      hidden_steam_ids: string[];
      aliases: Record<string, string>;
      display_names: Record<string, string>;
    }>(
      `select team_name, tracked_steam_ids, hidden_steam_ids, aliases, display_names
         from app_config where id = 1`,
    ),
    readQuery<{ steam_id: string; persona: string; avatar: string }>(
      "select steam_id, persona, avatar from steam_profiles",
    ),
  ]);

  const row = config[0];
  return {
    matches: matches.map((m) => unpack<MatchRecord>(fromBase64(m.record))),
    config: {
      teamName: row?.team_name ?? "Nosso time",
      trackedSteamIds: row?.tracked_steam_ids ?? [],
      hiddenSteamIds: row?.hidden_steam_ids ?? [],
      aliases: row?.aliases ?? {},
      displayNames: row?.display_names ?? {},
    },
    profiles: Object.fromEntries(
      profiles.map((p) => [p.steam_id, { persona: p.persona, avatar: fullSize(p.avatar) }]),
    ),
  };
}

const cachedSnapshotBlob = unstable_cache(
  async (_revision: number): Promise<string> => {
    const blob = pack(await readSnapshot()).toString("base64");
    if (blob.length > CACHE_ENTRY_LIMIT) {
      console.error(
        `[store] snapshot comprimido tem ${blob.length} bytes e passou do limite de ${CACHE_ENTRY_LIMIT} do cache de dados; cada requisição vai voltar a ler o banco inteiro`,
      );
    }
    return blob;
  },
  ["cs2stats", "snapshot"],
  { revalidate: false },
);

async function loadSnapshot(revision: number): Promise<Snapshot> {
  try {
    return unpack<Snapshot>(fromBase64(await cachedSnapshotBlob(revision)));
  } catch {
    return readSnapshot();
  }
}

async function currentSnapshot(): Promise<Snapshot> {
  const revision = await currentRevision();
  if (!snapshot || snapshot.revision !== revision) {
    const data = loadSnapshot(revision);
    data.catch(() => {
      if (snapshot?.data === data) snapshot = null;
    });
    snapshot = { revision, data };
  }
  return snapshot.data;
}

export async function saveMatch(match: MatchRecord, fileHash: string | null = null): Promise<void> {
  const { record, heatmaps } = splitHeatmaps(match);
  await writeQuery(
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
      pack(record),
      fileHash,
    ],
  );
  await saveHeatmaps(match.id, heatmaps);
  await bumpRevision();
}

export async function dataRevision(): Promise<number> {
  return currentRevision();
}

export async function bumpDataRevision(): Promise<void> {
  await bumpRevision();
}

export async function listMatches(): Promise<MatchRecord[]> {
  return (await currentSnapshot()).matches;
}

export async function getProfiles(): Promise<Profiles> {
  return (await currentSnapshot()).profiles;
}

export async function getMatch(id: string): Promise<MatchRecord | null> {
  if (!UUID.test(id)) return null;
  const { matches } = await currentSnapshot();
  return matches.find((match) => match.id === id) ?? null;
}

export async function deleteMatch(id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const rows = await writeQuery<{ id: string }>(
    "delete from matches where id = $1 returning id",
    [id],
  );
  if (rows.length === 0) return false;
  await bumpRevision();
  return true;
}

export async function findByFileName(
  fileName: string,
  fileSizeBytes: number,
): Promise<{ id: string; hasHash: boolean; version: number } | null> {
  const rows = await readQuery<{ id: string; file_hash: string | null; version: number }>(
    "select id, file_hash, version from matches where file_name = $1 and file_size_bytes = $2 limit 1",
    [fileName, fileSizeBytes],
  );
  return rows[0]
    ? { id: rows[0].id, hasHash: rows[0].file_hash !== null, version: rows[0].version }
    : null;
}

export async function setFileHash(id: string, fileHash: string): Promise<void> {
  await writeQuery("update matches set file_hash = $2 where id = $1 and file_hash is null", [
    id,
    fileHash,
  ]);
}

export async function replaceMatch(id: string, match: MatchRecord): Promise<void> {
  const previous = await readQuery<{ record: string }>(
    "select encode(record, 'base64') as record from matches where id = $1",
    [id],
  );
  const kept = previous[0] ? unpack<MatchRecord>(fromBase64(previous[0].record)) : null;
  const withDate: MatchRecord =
    !match.playedAtKnown && kept
      ? { ...match, playedAt: kept.playedAt, playedAtKnown: kept.playedAtKnown }
      : match;

  const { record, heatmaps } = splitHeatmaps(withDate);
  await writeQuery(
    `update matches set
       version = $2, played_at = $3, map = $4, total_rounds = $5,
       fingerprint = $6, record = $7
     where id = $1`,
    [
      id,
      withDate.version,
      withDate.playedAt,
      withDate.map,
      withDate.totalRounds,
      fingerprintOf(withDate),
      pack(record),
    ],
  );
  await saveHeatmaps(id, heatmaps);
  await bumpRevision();
}

export async function findByFileHash(fileHash: string): Promise<StoredMatch | null> {
  const rows = await readQuery<StoredMatchRow>(
    `select ${STORED_COLUMNS} from matches where file_hash = $1 limit 1`,
    [fileHash],
  );
  return rows[0] ? storedMatch(rows[0]) : null;
}

export async function findByFingerprint(fingerprint: string): Promise<StoredMatch | null> {
  const rows = await readQuery<StoredMatchRow>(
    `select ${STORED_COLUMNS} from matches where fingerprint = $1`,
    [fingerprint],
  );
  return rows[0] ? storedMatch(rows[0]) : null;
}

export async function getConfig(): Promise<AppConfig> {
  return (await currentSnapshot()).config;
}

export async function saveConfig(config: AppConfig): Promise<void> {
  await writeQuery(
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
  await bumpRevision();
}
