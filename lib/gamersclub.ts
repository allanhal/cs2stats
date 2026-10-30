import { requireEnv } from "./env";

const ORIGIN = "https://gamersclub.com.br";
const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36";

export interface GcMatch {
  id: string;
  map: string;
  game: string;
  playedAt: string;
  scoreA: number;
  scoreB: number;
  teamA: string;
  teamB: string;
  won: boolean;
}

export interface GcPage {
  playerId: string;
  nick: string;
  matches: GcMatch[];
  totalMatches: number;
  totalPages: number;
}

interface GcListRow {
  idlobby_game: string;
  map_name: string;
  game: string;
  created_atp: string;
  score_a: string;
  score_b: string;
  room_a_name: string;
  room_b_name: string;
  room_a_player: boolean;
  room_a_vitoria: boolean;
  room_b_vitoria: boolean;
}

interface GcListResponse {
  success: boolean;
  lista?: GcListRow[];
  currentUser?: { id: string; nick: string };
  pagination?: { total: string; pages_total: number; current_page: string };
  selectDates?: { dataURL: string }[];
}

export class GcAuthError extends Error {}

function headers(referer: string): Record<string, string> {
  return {
    accept: "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9,en;q=0.8",
    cookie: requireEnv("GAMERSCLUB_COOKIE"),
    referer,
    "user-agent": BROWSER_UA,
  };
}

async function getJson<T>(path: string, referer: string): Promise<T> {
  const response = await fetch(`${ORIGIN}${path}`, { headers: headers(referer) });
  const body = await response.text();
  if (!response.ok) {
    throw new GcAuthError(`GET ${path} respondeu ${response.status}`);
  }
  if (!body.trimStart().startsWith("{")) {
    throw new GcAuthError(`GET ${path} devolveu HTML; o cookie da Gamers Club expirou`);
  }
  return JSON.parse(body) as T;
}

function toIsoUtc(stamp: string): string {
  return new Date(`${stamp.replace(" ", "T")}Z`).toISOString();
}

export async function listMonth(month: string, page: number): Promise<GcPage> {
  const data = await getJson<GcListResponse>(
    `/players/get_playerLobbyResults/${month}/${page}`,
    `${ORIGIN}/my-matches`,
  );
  const rows = data.lista ?? [];
  return {
    playerId: data.currentUser?.id ?? "",
    nick: data.currentUser?.nick ?? "",
    totalMatches: Number(data.pagination?.total ?? 0),
    totalPages: data.pagination?.pages_total ?? 0,
    matches: rows.map((row) => ({
      id: row.idlobby_game,
      map: row.map_name,
      game: row.game,
      playedAt: toIsoUtc(row.created_atp),
      scoreA: Number(row.score_a),
      scoreB: Number(row.score_b),
      teamA: row.room_a_name,
      teamB: row.room_b_name,
      won: row.room_a_player ? row.room_a_vitoria : row.room_b_vitoria,
    })),
  };
}

export async function listAvailableMonths(): Promise<string[]> {
  const data = await getJson<GcListResponse>(
    `/players/get_playerLobbyResults/${currentMonth()}/1`,
    `${ORIGIN}/my-matches`,
  );
  return (data.selectDates ?? []).map((entry) => entry.dataURL);
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
}

export async function listEveryMatch(month: string): Promise<GcMatch[]> {
  const first = await listMonth(month, 1);
  const all = [...first.matches];
  for (let page = 2; page <= first.totalPages; page += 1) {
    await pause(1500, 3500);
    const next = await listMonth(month, page);
    all.push(...next.matches);
  }
  return all;
}

export async function demoUrl(matchId: string): Promise<string | null> {
  const data = await getJson<{ success: boolean; demo?: string }>(
    `/lobby/demoDownload/${matchId}`,
    `${ORIGIN}/lobby/match/${matchId}`,
  );
  return data.demo ?? null;
}

export async function demoIsAlive(url: string): Promise<boolean> {
  const response = await fetch(url, {
    method: "GET",
    headers: { "user-agent": BROWSER_UA, range: "bytes=0-0" },
    redirect: "manual",
  });
  await response.body?.cancel();
  return response.status === 200 || response.status === 206;
}

export function pause(minMs: number, maxMs: number): Promise<void> {
  const span = Math.max(0, maxMs - minMs);
  return new Promise((resolve) => setTimeout(resolve, minMs + Math.random() * span));
}
