import { createRequire } from "node:module";
import { closeSync, openSync, readSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseFileName } from "./filename";
import type {
  BuyType,
  HitGroup,
  MatchRecord,
  PlayerMatchStats,
  RoundRecord,
  Side,
  WeaponUse,
} from "./types";

const require = createRequire(import.meta.url);
type Parser = {
  parseHeader: (p: string) => Record<string, string>;
  parseEvents: (
    p: string,
    names: string[],
    playerExtra?: string[],
    otherExtra?: string[],
  ) => DemoEvent[];
  parseTicks: (p: string, props: string[], ticks?: number[]) => TickRow[];
};
const loadParser = (): Parser => require("@laihoe/demoparser2");

const TICK_RATE = 64;
const TRADE_WINDOW_TICKS = 5 * TICK_RATE;
import { SCHEMA_VERSION } from "./schema";

export { SCHEMA_VERSION };

const FIRE_WEAPONS = new Set(["inferno", "molotov", "incgrenade", "firebomb"]);
const UTILITY_WEAPONS = new Set([
  "inferno",
  "molotov",
  "incgrenade",
  "firebomb",
  "hegrenade",
  "flashbang",
  "smokegrenade",
  "decoy",
]);
const SNIPERS = new Set(["awp", "ssg08", "scar20", "g3sg1"]);
const ECONOMY_SNIPERS = new Set(["awp", "ssg08"]);
const PISTOLS = new Set([
  "glock18",
  "glock",
  "usps",
  "uspsilencer",
  "hkp2000",
  "p2000",
  "p250",
  "fiveseven",
  "tec9",
  "cz75a",
  "cz75auto",
  "elite",
  "dualberettas",
  "deagle",
  "deserteagle",
  "revolver",
  "r8revolver",
]);
const PRIMARIES = new Set([
  "ak47",
  "m4a1",
  "m4a1s",
  "m4a1silencer",
  "m4a4",
  "galilar",
  "famas",
  "sg553",
  "sg556",
  "aug",
  "m249",
  "negev",
  "mag7",
  "sawedoff",
  "nova",
  "xm1014",
  "mac10",
  "mp9",
  "mp7",
  "mp5sd",
  "ump45",
  "p90",
  "bizon",
  "ppbizon",
  "awp",
  "ssg08",
  "scar20",
  "g3sg1",
]);
const HIT_GROUP_BY_INDEX: HitGroup[] = [
  "other",
  "head",
  "chest",
  "stomach",
  "arms",
  "arms",
  "legs",
  "legs",
  "head",
];

interface DemoEvent {
  event_name: string;
  tick: number;
  total_rounds_played?: number;
  is_warmup_period?: boolean;
  [key: string]: unknown;
}

interface TickRow {
  tick: number;
  steamid: string | null;
  name: string | null;
  [key: string]: unknown;
}

function sideOf(value: unknown): Side | null {
  if (value === 2) return "T";
  if (value === 3) return "CT";
  if (typeof value === "string") {
    const v = value.toUpperCase();
    if (v === "T" || v === "TERRORIST") return "T";
    if (v === "CT" || v === "COUNTER_TERRORIST" || v === "COUNTERTERRORIST") return "CT";
  }
  return null;
}

const other = (s: Side): Side => (s === "CT" ? "T" : "CT");
const otherSquad = (s: "A" | "B"): "A" | "B" => (s === "A" ? "B" : "A");

const round1 = (v: number): number => Math.round(v * 10) / 10;

const messageOf = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

const bareWeapon = (value: unknown) => (str(value) ?? "").replace(/^weapon_/, "");
const HURT_FIRE_WINDOW_TICKS = 128;
const HURT_FIRE_SLACK_TICKS = 8;
const normalizeWeapon = (value: unknown) =>
  String(value ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const isGun = (weapon: string) => {
  const name = normalizeWeapon(weapon);
  return PRIMARIES.has(name) || PISTOLS.has(name);
};

const SILENCED_SIBLING: Record<string, string> = {
  m4a1: "m4a1_silencer",
  hkp2000: "usp_silencer",
};

function buildWeaponResolver(fires: Record<string, unknown>[]) {
  const shotsBy = new Map<string, { tick: number; weapon: string }[]>();
  for (const fire of fires) {
    const id = str(fire.user_steamid);
    const weapon = bareWeapon(fire.weapon);
    if (!id || !weapon) continue;
    const list = shotsBy.get(id) ?? [];
    list.push({ tick: num(fire.tick), weapon });
    shotsBy.set(id, list);
  }
  for (const list of shotsBy.values()) list.sort((a, b) => a.tick - b.tick);

  return (steamId: string, tick: number, weapon: string): string => {
    const silenced = SILENCED_SIBLING[weapon];
    if (!silenced) return weapon;
    const list = shotsBy.get(steamId);
    if (!list || list.length === 0) return weapon;

    for (let i = list.length - 1; i >= 0; i -= 1) {
      if (list[i].tick > tick + HURT_FIRE_SLACK_TICKS) continue;
      if (tick - list[i].tick > HURT_FIRE_WINDOW_TICKS) break;
      if (list[i].weapon === weapon || list[i].weapon === silenced) return list[i].weapon;
    }

    let firedBase = false;
    let firedSilenced = false;
    for (const shot of list) {
      if (shot.weapon === weapon) firedBase = true;
      else if (shot.weapon === silenced) firedSilenced = true;
    }
    return firedSilenced && !firedBase ? silenced : weapon;
  };
}

function hitGroupOf(value: unknown): HitGroup {
  if (typeof value === "number") return HIT_GROUP_BY_INDEX[value] ?? "other";
  const name = (str(value) ?? "").toLowerCase();
  if (name.includes("head") || name.includes("neck")) return "head";
  if (name.includes("chest")) return "chest";
  if (name.includes("stomach") || name.includes("belly")) return "stomach";
  if (name.includes("arm") || name.includes("hand")) return "arms";
  if (name.includes("leg") || name.includes("foot")) return "legs";
  return "other";
}

function emptyHitGroups(): Record<HitGroup, number> {
  return { head: 0, chest: 0, stomach: 0, arms: 0, legs: 0, other: 0 };
}

const emptyWeaponUse = (): WeaponUse => ({
  shots: 0,
  hits: 0,
  headshots: 0,
  damage: 0,
  kills: 0,
});

function roundReason(message: unknown, reason: unknown): string {
  const labels: Record<string, string> = {
    target_bombed: "bomb_exploded",
    bomb_defused: "bomb_defused",
    cts_win: "ct_elimination",
    terrorists_win: "t_elimination",
    target_saved: "time_expired",
    round_draw: "draw",
    cts_surrender: "ct_surrender",
    terrorists_surrender: "t_surrender",
    tteam_surrender: "t_surrender",
    ctteam_surrender: "ct_surrender",

    ct_killed: "t_elimination",
    t_killed: "ct_elimination",
    bomb_exploded: "bomb_exploded",
    time_ran_out: "time_expired",
    ct_win: "ct_elimination",
    t_win: "t_elimination",
  };

  for (const candidate of [message, reason]) {
    if (typeof candidate !== "string") continue;
    const key = candidate.replace("#SFUI_Notice_", "").toLowerCase();
    if (labels[key]) return labels[key];
    if (key.length > 0) return key;
  }
  return typeof reason === "number" ? `reason_${reason}` : "unknown";
}

function classifyBuy(value: number, isFirstOfHalf: boolean): BuyType {
  if (isFirstOfHalf && value <= 6000) return "pistol";
  if (value < 5000) return "eco";
  if (value < 10000) return "force";
  if (value < 20000) return "semi";
  return "full";
}

function emptyBuyStats(): PlayerMatchStats["byBuy"] {
  const blank = () => ({ rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 });
  return { pistol: blank(), eco: blank(), force: blank(), semi: blank(), full: blank() };
}

function emptyPlayer(steamId: string, name: string, squad: "A" | "B"): PlayerMatchStats {
  return {
    steamId,
    name,
    squad,
    roundsPlayed: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    flashAssists: 0,
    headshotKills: 0,
    damage: 0,
    utilityDamage: 0,
    enemiesFlashed: 0,
    mvps: 0,
    kastRounds: 0,
    survivedRounds: 0,
    openingKills: 0,
    openingDeaths: 0,
    openingKillRoundsWon: 0,
    sniperOpeningKills: 0,
    sniperOpeningDeaths: 0,
    byBuy: emptyBuyStats(),
    byEnemyBuy: emptyBuyStats(),
    sniperRounds: { pistol: 0, eco: 0, force: 0, semi: 0, full: 0 },
    sniperRoundsWon: { pistol: 0, eco: 0, force: 0, semi: 0, full: 0 },
    sniperKills: 0,
    sniperDeaths: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    multiKills: { k1: 0, k2: 0, k3: 0, k4: 0, k5: 0 },
    multiKillRoundsLost: 0,
    grenadeDamage: { he: 0, fire: 0 },
    openingDeathRoundsWon: 0,
    duelMs: 0,
    duelKills: 0,
    reactionMs: 0,
    reactionKills: 0,
    awpShots: 0,
    awpHits: 0,
    awpMisses: 0,
    awpRepeeks: 0,
    awpRepeekHits: 0,
    awpMissDeaths: 0,
    hits: emptyHitGroups(),
    hitDamage: emptyHitGroups(),
    hitsBySide: { CT: emptyHitGroups(), T: emptyHitGroups() },
    weaponUse: {},
    firstShots: 0,
    firstHits: 0,
    sprayShots: 0,
    sprayHits: 0,
    lifeMs: 0,
    lifeRounds: 0,
    firstKillMs: 0,
    firstKillRounds: 0,
    bestKillStreak: 0,
    zeroKillStreak: 0,
    zeroDamageStreak: 0,
    postPlantRounds: 0,
    postPlantWon: 0,
    retakeRounds: 0,
    retakeWon: 0,
    zeroDamageRounds: 0,
    equipValue: 0,
    equipRounds: 0,
    cashSpent: 0,
    lostRoundsSurvived: 0,
    saveRounds: 0,
    saveNextWon: 0,
    clutchesWon: { v1: 0, v2: 0, v3: 0, v4: 0, v5: 0 },
    clutchesPlayed: 0,
    bombsPlanted: 0,
    bombsDefused: 0,
    zeroKillRounds: 0,
    teamKills: 0,
    teamKillDeaths: 0,
    teamDamage: 0,
    selfDamage: 0,
    teamFlashes: 0,
    teamFlashSeconds: 0,
    selfFlashes: 0,
    selfFlashSeconds: 0,
    enemyFlashSeconds: 0,
    blindKills: 0,
    noScopeKills: 0,
    throughSmokeKills: 0,
    wallbangKills: 0,
    killsByPlace: {},
    deathsByPlace: {},
    placesVisited: {},
    heatmap: {},
    heatmapKills: {},
    heatmapDeaths: {},
    bySide: { CT: { rounds: 0, kills: 0, deaths: 0, damage: 0 }, T: { rounds: 0, kills: 0, deaths: 0, damage: 0 } },
    weapons: {},
  };
}

export interface ExtractMeta {
  fileName: string;
  uploadedBy: string;
}

function assertDemoFile(filePath: string): void {
  const handle = openSync(filePath, "r");
  const head = Buffer.alloc(8);
  try {
    readSync(handle, head, 0, 8, 0);
  } finally {
    closeSync(handle);
  }
  const magic = head.toString("latin1").replace(/\0/g, "").trim();
  if (magic.startsWith("PBDEMS2")) return;
  if (magic.startsWith("HL2DEMO")) {
    throw new Error("esta é uma demo de CS:GO; o parser só lê demos de CS2");
  }
  throw new Error(
    `este arquivo não parece uma demo de CS2 (ele começa com "${magic.slice(0, 8)}")`,
  );
}

export function extractMatch(filePath: string, meta: ExtractMeta): MatchRecord {
  assertDemoFile(filePath);
  const parser = loadParser();
  const header = parser.parseHeader(filePath);

  const EVENT_NAMES = [
    "player_death",
    "player_hurt",
    "weapon_fire",
    "player_blind",
    "player_footstep",
    "round_end",
    "round_freeze_end",
    "round_mvp",
    "bomb_planted",
    "bomb_defused",
  ];
  const CRITICAL_EVENTS = new Set([
    "player_death",
    "player_hurt",
    "round_end",
    "round_freeze_end",
  ]);
  const readEvents = (names: string[], playerExtra: string[], otherExtra: string[]): DemoEvent[] =>
    parser.parseEvents(filePath, names, playerExtra, otherExtra);

  const ATTEMPTS: { playerExtra: string[]; otherExtra: string[] }[] = [
    {
      playerExtra: ["team_num", "last_place_name", "X", "Y"],
      otherExtra: ["total_rounds_played", "is_warmup_period"],
    },
    {
      playerExtra: ["team_num", "last_place_name"],
      otherExtra: ["total_rounds_played", "is_warmup_period"],
    },
    { playerExtra: [], otherExtra: ["total_rounds_played", "is_warmup_period"] },
    { playerExtra: ["team_num", "last_place_name"], otherExtra: [] },
    { playerExtra: [], otherExtra: [] },
  ];

  let events: DemoEvent[] | null = null;
  let firstFailure = "";
  for (const attempt of ATTEMPTS) {
    try {
      events = readEvents(EVENT_NAMES, attempt.playerExtra, attempt.otherExtra);
      break;
    } catch (error) {
      if (!firstFailure) firstFailure = messageOf(error);
    }
  }

  if (!events) {
    const working: string[] = [];
    const recovered: DemoEvent[] = [];
    for (const name of EVENT_NAMES) {
      try {
        recovered.push(...readEvents([name], [], []));
        working.push(name);
      } catch {
        continue;
      }
    }
    if (!working.includes("round_end")) {
      let ticksOk = false;
      try {
        ticksOk = parser.parseTicks(filePath, ["team_num"], [128, 2048, 16384]).length > 0;
      } catch {
        ticksOk = false;
      }
      const unsupported = /EntityNotFound/.test(firstFailure);
      const symptom = unsupported
        ? "o formato desta demo ainda não é suportado pelo parser"
        : ticksOk
          ? "o arquivo abre, mas o parser não lê nenhum evento dela"
          : "o arquivo está truncado ou corrompido";
      const nextStep = unsupported ? "aguarde uma atualização do parser" : "baixe o arquivo de novo";
      throw new Error(
        `o parser não leu esta demo (${firstFailure}): ${symptom}; ${nextStep}. Sem: ${
          working.length === 0
            ? "todos os eventos"
            : Array.from(CRITICAL_EVENTS).filter((name) => !working.includes(name)).join(", ") ||
              "round_end"
        }`,
      );
    }
    events = recovered;
  }

  const live = events.filter((e) => e.is_warmup_period !== true);
  const byName = (name: string) => live.filter((e) => e.event_name === name);

  const MIN_ROUND_TICKS = 5 * TICK_RATE;
  const roundEnds = byName("round_end").sort((a, b) => a.tick - b.tick);
  const roundEvents: DemoEvent[] = [];
  for (const e of roundEnds) {
    const previousEnd = roundEvents[roundEvents.length - 1];

    if (previousEnd && e.tick - previousEnd.tick < MIN_ROUND_TICKS) continue;
    roundEvents.push(e);
  }
  if (roundEvents.length === 0) {
    throw new Error("Nenhum round encontrado na demo (arquivo incompleto ou corrompido?)");
  }

  const allEndTicks = roundEvents.map((e) => e.tick);

  function rawRoundAt(tick: number): number {
    for (let i = 0; i < allEndTicks.length; i++) {
      if (tick <= allEndTicks[i]) return i;
    }
    return -1;
  }

  const freezeTicks: (number | null)[] = roundEvents.map(() => null);
  for (const e of byName("round_freeze_end").sort((a, b) => a.tick - b.tick)) {
    const r = rawRoundAt(e.tick);
    if (r >= 0) freezeTicks[r] = e.tick;
  }

  const heatTicks: number[] = [];
  const lastRoundTick = allEndTicks[allEndTicks.length - 1];
  for (let tick = TICK_RATE; tick < lastRoundTick; tick += TICK_RATE) heatTicks.push(tick);
  const heatTickSet = new Set(heatTicks);
  const boundaryTicks = [...allEndTicks, ...freezeTicks.filter((t): t is number => t !== null)];
  const snapshotTicks = Array.from(
    new Set([
      ...boundaryTicks.flatMap((tick) => [tick - 1, tick, tick + 1].filter((value) => value >= 0)),
      ...heatTicks,
    ]),
  ).sort((a, b) => a - b);

  const readTicks = (props: string[], ticks: number[]): TickRow[] => {
    try {
      return parser.parseTicks(filePath, props, ticks);
    } catch {
      return [];
    }
  };

  const TICK_PROPS = [
      "team_num",
      "team_clan_name",
      "team_rounds_total",
      "CCSPlayerPawn.m_unFreezetimeEndEquipmentValue",
      "inventory",
      "last_place_name",
      "X",
      "Y",
  ];

  const combineRows = (groups: TickRow[][]): TickRow[] => {
    const combined = new Map<string, TickRow>();
    for (const group of groups) {
      for (const row of group) {
        const key = `${row.tick}|${row.steamid ?? row.name ?? ""}`;
        combined.set(key, { ...combined.get(key), ...row });
      }
    }
    return Array.from(combined.values());
  };

  let rows: TickRow[];
  try {
    rows = parser.parseTicks(filePath, TICK_PROPS, snapshotTicks);
  } catch (error) {
    rows = combineRows(TICK_PROPS.map((prop) => readTicks([prop], snapshotTicks)));
    if (rows.length === 0) {
      const broken = TICK_PROPS.filter((prop) => readTicks([prop], [allEndTicks[0]]).length === 0);
      throw new Error(
        `o parser não leu os ticks desta demo (${messageOf(error)}); problema em: ${
          broken.join(", ") || "nenhuma propriedade isolada"
        }`,
      );
    }
  }

  const snapshots = new Map<number, TickRow[]>();
  for (const row of rows) {
    if (!row.steamid) continue;
    const list = snapshots.get(row.tick);
    if (list) list.push(row);
    else snapshots.set(row.tick, [row]);
  }

  function snapshotAt(tick: number): TickRow[] {
    return snapshots.get(tick) ?? snapshots.get(tick - 1) ?? snapshots.get(tick + 1) ?? [];
  }

  const squadOf = new Map<string, "A" | "B">();
  const nameOf = new Map<string, string>();
  for (const row of snapshotAt(allEndTicks[0])) {
    const side = sideOf(row.team_num);
    if (!side || !row.steamid) continue;
    squadOf.set(row.steamid, side === "CT" ? "A" : "B");
    if (row.name) nameOf.set(row.steamid, row.name);
  }

  function sideOfSquadAt(tick: number, squad: "A" | "B"): Side | null {
    let ct = 0;
    let t = 0;
    for (const row of snapshotAt(tick)) {
      if (!row.steamid || squadOf.get(row.steamid) !== squad) continue;
      const side = sideOf(row.team_num);
      if (side === "CT") ct++;
      else if (side === "T") t++;
    }
    if (ct === 0 && t === 0) return null;
    return ct >= t ? "CT" : "T";
  }

  function counterAt(tick: number, squad: "A" | "B"): number | null {
    for (const row of snapshotAt(tick)) {
      if (row.steamid && squadOf.get(row.steamid) === squad) {
        const value = row.team_rounds_total;
        if (typeof value === "number") return value;
      }
    }
    return null;
  }

  const rawWinners: ("A" | "B" | null)[] = roundEvents.map(() => null);
  let running = { A: 0, B: 0 };
  let firstCounted = 0;
  roundEvents.forEach((end, i) => {
    const a = counterAt(end.tick, "A") ?? running.A;
    const b = counterAt(end.tick, "B") ?? running.B;
    if (a < running.A || b < running.B) {
      firstCounted = i;
      running = { A: 0, B: 0 };
    }
    rawWinners[i] = a > running.A ? "A" : b > running.B ? "B" : null;
    running = { A: a, B: b };
  });

  const kept: { end: DemoEvent; winner: "A" | "B"; from: number; freeze: number | null }[] = [];
  for (let i = firstCounted; i < roundEvents.length; i++) {
    const winner = rawWinners[i];
    if (!winner) continue;
    kept.push({
      end: roundEvents[i],
      winner,
      from: i === 0 ? 0 : roundEvents[i - 1].tick,
      freeze: freezeTicks[i],
    });
  }
  if (kept.length === 0) {
    throw new Error("Nenhum round pontuado na demo (a partida chegou ao fim?)");
  }

  function roundAt(tick: number): number {
    for (let i = 0; i < kept.length; i++) {
      if (tick > kept[i].from && tick <= kept[i].end.tick) return i;
    }
    return -1;
  }

  function assignLate(steamId: string, snapshotTick: number): "A" | "B" | null {
    const existing = squadOf.get(steamId);
    if (existing) return existing;
    const row = snapshotAt(snapshotTick).find((r) => r.steamid === steamId);
    const side = sideOf(row?.team_num);
    if (!side) return null;
    const squad = sideOfSquadAt(snapshotTick, "A") === side ? "A" : "B";
    squadOf.set(steamId, squad);
    return squad;
  }

  const players = new Map<string, PlayerMatchStats>();
  function playerAt(
    steamId: string | null,
    name: string | null,
    snapshotTick: number,
  ): PlayerMatchStats | null {
    if (!steamId) return null;
    const existing = players.get(steamId);
    if (existing) {
      if (name && existing.name !== name) existing.name = name;
      return existing;
    }
    const squad = assignLate(steamId, snapshotTick);
    if (!squad) return null;
    const created = emptyPlayer(steamId, name ?? nameOf.get(steamId) ?? steamId, squad);
    players.set(steamId, created);
    return created;
  }

  const deaths = byName("player_death").sort((a, b) => a.tick - b.tick);
  const hurts = byName("player_hurt");
  const plants = byName("bomb_planted");
  const defuses = byName("bomb_defused");
  const mvpEvents = byName("round_mvp");
  const blinds = byName("player_blind");
  const footsteps = byName("player_footstep");
  const fires = byName("weapon_fire");

  const sideByRound: { A: Side; B: Side }[] = [];
  const isFirstOfHalf: boolean[] = [];
  let previousSideA: Side | null = null;
  kept.forEach((round, i) => {
    const sideA = sideOfSquadAt(round.end.tick, "A") ?? previousSideA ?? "CT";
    sideByRound.push({ A: sideA, B: other(sideA) });
    isFirstOfHalf.push(i === 0 || (previousSideA != null && sideA !== previousSideA));
    previousSideA = sideA;
  });

  const rounds: RoundRecord[] = [];
  const sniperPlayers = kept.map(() => new Set<string>());
  const score = { A: 0, B: 0 };

  kept.forEach((round, i) => {
    const sides = sideByRound[i];
    score[round.winner] += 1;

    const buy = { A: 0, B: 0 };
    const snipers = { A: 0, B: 0 };
    if (round.freeze != null) {
      for (const row of snapshotAt(round.freeze)) {
        if (!row.steamid) continue;
        const squad = assignLate(row.steamid, round.freeze);
        if (!squad) continue;
        buy[squad] += num(row["CCSPlayerPawn.m_unFreezetimeEndEquipmentValue"]);
        const inventory = row.inventory;
        const hasSniper =
          Array.isArray(inventory) &&
          inventory.some((weapon) => ECONOMY_SNIPERS.has(normalizeWeapon(weapon)));
        if (hasSniper) {
          snipers[squad] += 1;
          sniperPlayers[i].add(row.steamid);
          playerAt(row.steamid, row.name, round.freeze);
        }
      }
    }

    rounds.push({
      number: i + 1,
      winnerSquad: round.winner,
      winnerSide: sides[round.winner],
      reason: roundReason(round.end.message, round.end.reason),
      bombPlanted: false,
      openingSquad: null,
      multiKill: { A: false, B: false },
      buy,
      buyType: {
        A: classifyBuy(buy.A, isFirstOfHalf[i]),
        B: classifyBuy(buy.B, isFirstOfHalf[i]),
      },
      snipers,
      score: { ...score },
    });
  });

  for (const e of plants) {
    const r = roundAt(e.tick);
    if (r >= 0) rounds[r].bombPlanted = true;
  }

  const participants: Map<string, Side>[] = kept.map(() => new Map());
  kept.forEach((round, i) => {
    const sides = sideByRound[i];
    for (const row of snapshotAt(round.end.tick)) {
      if (!row.steamid || !sideOf(row.team_num)) continue;
      playerAt(row.steamid, row.name, round.end.tick);
      const squad = squadOf.get(row.steamid);
      if (!squad) continue;
      participants[i].set(row.steamid, sides[squad]);
    }
  });

  for (const d of deaths) {
    const r = roundAt(d.tick);
    if (r < 0) continue;
    const endTick = kept[r].end.tick;
    for (const [idKey, nameKey, teamKey] of [
      ["user_steamid", "user_name", "user_team_num"],
      ["attacker_steamid", "attacker_name", "attacker_team_num"],
    ] as const) {
      const steamId = str(d[idKey]);
      const side = sideOf(d[teamKey]);
      if (!steamId || !side || participants[r].has(steamId)) continue;
      playerAt(steamId, str(d[nameKey]), endTick);
      participants[r].set(steamId, side);
    }
  }

  const sideIn = (raw: unknown, roundIndex: number, steamId: string | null): Side | null => {
    const direct = sideOf(raw);
    if (direct) return direct;
    if (!steamId || roundIndex < 0) return null;
    return participants[roundIndex].get(steamId) ?? null;
  };

  const visitedPlaces: Map<string, Set<string>>[] = kept.map(() => new Map());
  for (const footstep of footsteps) {
    const roundIndex = roundAt(footstep.tick);
    if (roundIndex < 0) continue;
    const steamId = str(footstep.user_steamid);
    const place = str(footstep.user_last_place_name);
    if (!steamId || !place) continue;
    const side = sideIn(footstep.user_team_num, roundIndex, steamId);
    if (!side) continue;
    playerAt(steamId, str(footstep.user_name), kept[roundIndex].end.tick);
    const places = visitedPlaces[roundIndex].get(steamId) ?? new Set<string>();
    places.add(`${side}|${place}`);
    visitedPlaces[roundIndex].set(steamId, places);
  }

  participants.forEach((map, roundIndex) => {
    for (const [steamId, side] of map) {
      const p = players.get(steamId);
      if (!p) continue;
      p.roundsPlayed += 1;
      p.bySide[side].rounds += 1;
      const buy = p.byBuy[rounds[roundIndex].buyType[p.squad]];
      const enemyBuy = p.byEnemyBuy[rounds[roundIndex].buyType[otherSquad(p.squad)]];
      buy.rounds += 1;
      enemyBuy.rounds += 1;
      if (rounds[roundIndex].winnerSquad === p.squad) {
        buy.won += 1;
        enemyBuy.won += 1;
      }
    }
  });

  sniperPlayers.forEach((ids, roundIndex) => {
    for (const steamId of ids) {
      const p = players.get(steamId);
      if (!p) continue;
      const buy = rounds[roundIndex].buyType[p.squad];
      p.sniperRounds[buy] += 1;
      if (rounds[roundIndex].winnerSquad === p.squad) p.sniperRoundsWon[buy] += 1;
    }
  });

  visitedPlaces.forEach((playersInRound) => {
    for (const [steamId, places] of playersInRound) {
      const p = players.get(steamId);
      if (!p) continue;
      for (const route of places) {
        const key = `${header.map_name ?? "unknown"}|${route}`;
        p.placesVisited[key] = (p.placesVisited[key] ?? 0) + 1;
      }
    }
  });

  for (const tick of heatTickSet) {
    const roundIndex = roundAt(tick);
    if (roundIndex < 0) continue;
    for (const row of snapshotAt(tick)) {
      if (!row.steamid) continue;
      const place = str(row.last_place_name);
      const x = row.X;
      const y = row.Y;
      if (!place || /spawn/i.test(place) || typeof x !== "number" || typeof y !== "number") continue;
      const side = sideOf(row.team_num) ?? participants[roundIndex].get(row.steamid);
      if (!side) continue;
      const p = playerAt(row.steamid, row.name, kept[roundIndex].end.tick);
      if (!p) continue;
      const cellX = Math.round(x / 128) * 128;
      const cellY = Math.round(y / 128) * 128;
      const key = `${side}|${cellX}|${cellY}`;
      const heatmap = (p.heatmap ??= {});
      heatmap[key] = (heatmap[key] ?? 0) + 1;
    }
  }

  const addOutcomeCell = (
    steamId: string | null,
    rawX: unknown,
    rawY: unknown,
    side: Side | null,
    field: "heatmapKills" | "heatmapDeaths",
  ): void => {
    if (!steamId || !side) return;
    if (typeof rawX !== "number" || typeof rawY !== "number") return;
    const p = players.get(steamId);
    if (!p) return;
    const key = `${side}|${Math.round(rawX / 128) * 128}|${Math.round(rawY / 128) * 128}`;
    const cells = (p[field] ??= {});
    cells[key] = (cells[key] ?? 0) + 1;
  };

  for (const d of deaths) {
    const roundIndex = roundAt(d.tick);
    if (roundIndex < 0) continue;
    const victimId = str(d.user_steamid);
    const attackerId = str(d.attacker_steamid);
    addOutcomeCell(
      victimId,
      d.user_X,
      d.user_Y,
      sideIn(d.user_team_num, roundIndex, victimId),
      "heatmapDeaths",
    );
    if (attackerId && attackerId !== victimId) {
      addOutcomeCell(
        attackerId,
        d.attacker_X,
        d.attacker_Y,
        sideIn(d.attacker_team_num, roundIndex, attackerId),
        "heatmapKills",
      );
    }
  }

  const firstHurtTick = new Map<string, number>();
  for (const h of hurts) {
    const roundIndex = roundAt(h.tick);
    if (roundIndex < 0) continue;
    const attackerId = str(h.attacker_steamid);
    const victimId = str(h.user_steamid);
    if (!attackerId || !victimId || attackerId === victimId) continue;
    if (UTILITY_WEAPONS.has((str(h.weapon) ?? "").replace(/^weapon_/, ""))) continue;
    const key = `${roundIndex}|${attackerId}|${victimId}`;
    const current = firstHurtTick.get(key);
    if (current === undefined || h.tick < current) firstHurtTick.set(key, h.tick);
  }

  const damagedInRound = new Set<string>();
  for (const h of hurts) {
    const roundIndex = roundAt(h.tick);
    if (roundIndex < 0) continue;
    const attackerId = str(h.attacker_steamid);
    const victimId = str(h.user_steamid);
    if (!attackerId || attackerId === victimId) continue;
    if (
      sideIn(h.attacker_team_num, roundIndex, attackerId) ===
      sideIn(h.user_team_num, roundIndex, victimId)
    ) {
      continue;
    }
    if (num(h.dmg_health) <= 0) continue;
    damagedInRound.add(`${roundIndex}|${attackerId}`);
  }

  const keptPrimary: Set<string>[] = kept.map(() => new Set<string>());
  kept.forEach((round, roundIndex) => {
    for (const row of snapshotAt(round.end.tick)) {
      const inventory = row.inventory;
      if (!row.steamid || !Array.isArray(inventory)) continue;
      if (inventory.some((weapon) => PRIMARIES.has(normalizeWeapon(weapon)))) {
        keptPrimary[roundIndex].add(row.steamid);
      }
    }
  });

  kept.forEach((round) => {
    if (round.freeze == null) return;
    for (const row of snapshotAt(round.freeze)) {
      if (!row.steamid) continue;
      const p = players.get(row.steamid);
      if (!p) continue;
      p.equipValue += num(row["CCSPlayerPawn.m_unFreezetimeEndEquipmentValue"]);
      p.equipRounds += 1;
    }
  });

  const dryKillRounds = new Map<string, number>();
  const dryDamageRounds = new Map<string, number>();

  const deathsByRound: DemoEvent[][] = kept.map(() => []);
  for (const d of deaths) {
    const r = roundAt(d.tick);
    if (r >= 0) deathsByRound[r].push(d);
  }

  kept.forEach((round, roundIndex) => {
    const list = deathsByRound[roundIndex];
    const map = participants[roundIndex];
    const winnerSide = sideByRound[roundIndex][round.winner];
    const endTick = round.end.tick;

    const startTick = round.freeze ?? round.from;
    const killsThisRound = new Map<string, number>();
    const deathTickOf = new Map<string, number>();
    const firstKillTickOf = new Map<string, number>();
    const assistedThisRound = new Set<string>();
    const diedThisRound = new Set<string>();
    const tradedThisRound = new Set<string>();

    const alive: Record<Side, Set<string>> = { CT: new Set(), T: new Set() };
    for (const [steamId, side] of map) alive[side].add(steamId);

    let clutcher: { steamId: string; enemies: number } | null = null;
    let opening = true;

    list.forEach((d) => {
      const victimId = str(d.user_steamid);
      const attackerId = str(d.attacker_steamid);
      const assisterId = str(d.assister_steamid);
      const victimSide = sideIn(d.user_team_num, roundIndex, victimId);
      const attackerSide = sideIn(d.attacker_team_num, roundIndex, attackerId);

      const victim = playerAt(victimId, str(d.user_name), endTick);
      const attacker = playerAt(attackerId, str(d.attacker_name), endTick);

      const teamKill =
        attackerSide != null && attackerSide === victimSide && attackerId !== victimId;

      if (victim && victimId) {
        victim.deaths += 1;
        diedThisRound.add(victimId);
        if (!deathTickOf.has(victimId)) deathTickOf.set(victimId, d.tick);
        if (victimSide) victim.bySide[victimSide].deaths += 1;
        victim.byBuy[rounds[roundIndex].buyType[victim.squad]].deaths += 1;
        victim.byEnemyBuy[rounds[roundIndex].buyType[otherSquad(victim.squad)]].deaths += 1;
        const place = str(d.user_last_place_name);
        if (place) victim.deathsByPlace[place] = (victim.deathsByPlace[place] ?? 0) + 1;
        if (teamKill) victim.teamKillDeaths += 1;
        if (sniperPlayers[roundIndex].has(victimId)) victim.sniperDeaths += 1;
      }

      if (attacker && teamKill) attacker.teamKills += 1;

      if (attacker && attackerId && !teamKill) {
        attacker.kills += 1;
        killsThisRound.set(attackerId, (killsThisRound.get(attackerId) ?? 0) + 1);
        if (d.headshot === true) attacker.headshotKills += 1;
        if (attackerSide) attacker.bySide[attackerSide].kills += 1;
        const firstHit = firstHurtTick.get(`${roundIndex}|${attackerId}|${victimId}`);
        if (firstHit !== undefined && d.tick >= firstHit) {
          attacker.duelMs += ((d.tick - firstHit) / TICK_RATE) * 1000;
          attacker.duelKills += 1;
        }
        const tookFirst = firstHurtTick.get(`${roundIndex}|${victimId}|${attackerId}`);
        if (tookFirst !== undefined && d.tick >= tookFirst) {
          attacker.reactionMs += ((d.tick - tookFirst) / TICK_RATE) * 1000;
          attacker.reactionKills += 1;
        }
        attacker.byBuy[rounds[roundIndex].buyType[attacker.squad]].kills += 1;
        attacker.byEnemyBuy[rounds[roundIndex].buyType[otherSquad(attacker.squad)]].kills += 1;
        if (!firstKillTickOf.has(attackerId)) firstKillTickOf.set(attackerId, d.tick);
        const weapon = str(d.weapon);
        if (weapon) attacker.weapons[weapon] = (attacker.weapons[weapon] ?? 0) + 1;
        const gun = bareWeapon(d.weapon);
        if (isGun(gun)) {
          const use = (attacker.weaponUse[gun] ??= emptyWeaponUse());
          use.kills += 1;
        }
        if (ECONOMY_SNIPERS.has(weapon ?? "")) attacker.sniperKills += 1;
        const place = str(d.attacker_last_place_name);
        if (place) attacker.killsByPlace[place] = (attacker.killsByPlace[place] ?? 0) + 1;
        if (d.attackerblind === true) attacker.blindKills += 1;
        if (d.noscope === true) attacker.noScopeKills += 1;
        if (d.thrusmoke === true) attacker.throughSmokeKills += 1;
        if (num(d.penetrated) > 0) attacker.wallbangKills += 1;

        const avenged = list.filter(
          (e) =>
            e.tick <= d.tick &&
            d.tick - e.tick <= TRADE_WINDOW_TICKS &&
            str(e.attacker_steamid) === victimId &&
            sideIn(e.user_team_num, roundIndex, str(e.user_steamid)) === attackerSide,
        );
        if (avenged.length > 0) {
          attacker.tradeKills += 1;
          for (const e of avenged) {
            const tradedId = str(e.user_steamid);
            if (!tradedId) continue;
            tradedThisRound.add(tradedId);
            const traded = players.get(tradedId);
            if (traded) traded.tradedDeaths += 1;
          }
        }
      }

      if (assisterId) {
        const assister = playerAt(assisterId, str(d.assister_name), endTick);
        if (assister) {
          assister.assists += 1;
          assistedThisRound.add(assisterId);
          if (d.assistedflash === true) assister.flashAssists += 1;
        }
      }

      if (opening && attacker && attackerId && !teamKill) {
        opening = false;
        rounds[roundIndex].openingSquad = attacker.squad;
        attacker.openingKills += 1;
        if (attackerSide === winnerSide) attacker.openingKillRoundsWon += 1;
        if (victim) {
          victim.openingDeaths += 1;
          if (victimSide === winnerSide) victim.openingDeathRoundsWon += 1;
        }
        if (SNIPERS.has(str(d.weapon) ?? "")) {
          attacker.sniperOpeningKills += 1;
          if (victim) victim.sniperOpeningDeaths += 1;
        }
      }

      if (victimId && victimSide) alive[victimSide].delete(victimId);
      if (!clutcher) {
        for (const side of ["CT", "T"] as Side[]) {
          if (alive[side].size === 1 && alive[other(side)].size >= 1) {
            const [last] = Array.from(alive[side]);
            clutcher = { steamId: last, enemies: alive[other(side)].size };
            break;
          }
        }
      }
    });

    if (clutcher) {
      const c: { steamId: string; enemies: number } = clutcher;
      const p = players.get(c.steamId);
      if (p) {
        p.clutchesPlayed += 1;
        if (map.get(c.steamId) === winnerSide) {
          const key = `v${Math.min(c.enemies, 5)}` as keyof PlayerMatchStats["clutchesWon"];
          p.clutchesWon[key] += 1;
        }
      }
    }

    for (const [steamId, n] of killsThisRound) {
      const p = players.get(steamId);
      if (!p) continue;
      const key = `k${Math.min(n, 5)}` as keyof PlayerMatchStats["multiKills"];
      p.multiKills[key] += 1;
      if (n >= 3) {
        rounds[roundIndex].multiKill[p.squad] = true;
        if (map.get(steamId) !== winnerSide) p.multiKillRoundsLost += 1;
      }
    }

    for (const [steamId, side] of map) {
      const p = players.get(steamId);
      if (!p) continue;
      const survived = !diedThisRound.has(steamId);
      if (survived) p.survivedRounds += 1;
      if ((killsThisRound.get(steamId) ?? 0) === 0) {
        p.zeroKillRounds += 1;
        const dry = (dryKillRounds.get(steamId) ?? 0) + 1;
        dryKillRounds.set(steamId, dry);
        if (dry > p.zeroKillStreak) p.zeroKillStreak = dry;
      } else {
        dryKillRounds.set(steamId, 0);
      }
      if (damagedInRound.has(`${roundIndex}|${steamId}`)) {
        dryDamageRounds.set(steamId, 0);
      } else {
        p.zeroDamageRounds += 1;
        const dry = (dryDamageRounds.get(steamId) ?? 0) + 1;
        dryDamageRounds.set(steamId, dry);
        if (dry > p.zeroDamageStreak) p.zeroDamageStreak = dry;
      }

      const deathTick = deathTickOf.get(steamId) ?? endTick;
      p.lifeMs += (Math.max(0, deathTick - startTick) / TICK_RATE) * 1000;
      p.lifeRounds += 1;
      const firstKillTick = firstKillTickOf.get(steamId);
      if (firstKillTick !== undefined) {
        p.firstKillMs += (Math.max(0, firstKillTick - startTick) / TICK_RATE) * 1000;
        p.firstKillRounds += 1;
      }

      const wonRound = side === winnerSide;
      if (rounds[roundIndex].bombPlanted) {
        if (side === "T") {
          p.postPlantRounds += 1;
          if (wonRound) p.postPlantWon += 1;
        } else {
          p.retakeRounds += 1;
          if (wonRound) p.retakeWon += 1;
        }
      }
      if (!wonRound && survived) {
        p.lostRoundsSurvived += 1;
        if (keptPrimary[roundIndex].has(steamId)) {
          p.saveRounds += 1;
          const next = rounds[roundIndex + 1];
          if (next && next.winnerSquad === p.squad) p.saveNextWon += 1;
        }
      }
      if (
        survived ||
        (killsThisRound.get(steamId) ?? 0) > 0 ||
        assistedThisRound.has(steamId) ||
        tradedThisRound.has(steamId)
      ) {
        p.kastRounds += 1;
      }
    }
  });

  const resolveFiredWeapon = buildWeaponResolver(fires);

  for (const h of hurts) {
    const roundIndex = roundAt(h.tick);
    if (roundIndex < 0) continue;
    const attackerId = str(h.attacker_steamid);
    const victimId = str(h.user_steamid);
    const attackerSide = sideIn(h.attacker_team_num, roundIndex, attackerId);
    const victimSide = sideIn(h.user_team_num, roundIndex, victimId);
    if (!attackerId || attackerSide == null) continue;
    const p = players.get(attackerId);
    if (!p) continue;
    const dmg = num(h.dmg_health);

    if (attackerId === victimId) p.selfDamage += dmg;
    else if (attackerSide === victimSide) p.teamDamage += dmg;
    else {
      p.damage += dmg;
      p.bySide[attackerSide].damage += dmg;
      p.byBuy[rounds[roundIndex].buyType[p.squad]].damage += dmg;
      p.byEnemyBuy[rounds[roundIndex].buyType[otherSquad(p.squad)]].damage += dmg;
      const weapon = str(h.weapon) ?? "";
      if (weapon === "hegrenade") p.grenadeDamage.he += dmg;
      else if (FIRE_WEAPONS.has(weapon)) p.grenadeDamage.fire += dmg;
      const group = hitGroupOf(h.hitgroup);
      p.hits[group] += 1;
      p.hitDamage[group] += dmg;
      if (victimSide) p.hitsBySide[victimSide][group] += 1;
      const gun = resolveFiredWeapon(attackerId, num(h.tick), bareWeapon(weapon));
      if (isGun(gun)) {
        const use = (p.weaponUse[gun] ??= emptyWeaponUse());
        use.hits += 1;
        use.damage += dmg;
        if (group === "head") use.headshots += 1;
      }
    }
  }

  for (const b of blinds) {
    if (roundAt(b.tick) < 0) continue;
    const throwerId = str(b.attacker_steamid);
    const victimId = str(b.user_steamid);
    if (!throwerId) continue;
    const p = players.get(throwerId);
    if (!p) continue;
    const seconds = num(b.blind_duration);
    const blindRound = roundAt(b.tick);
    const throwerSide = sideIn(b.attacker_team_num, blindRound, throwerId);
    const victimSide = sideIn(b.user_team_num, blindRound, victimId);

    if (throwerId === victimId) {
      p.selfFlashes += 1;
      p.selfFlashSeconds += seconds;
    } else if (throwerSide === victimSide) {
      p.teamFlashes += 1;
      p.teamFlashSeconds += seconds;
    } else {
      p.enemyFlashSeconds += seconds;
    }
  }

  const AWP_HIT_WINDOW = Math.round(TICK_RATE / 8);
  const AWP_REPEEK_WINDOW = 10 * TICK_RATE;
  const awpShotTicks = new Map<string, number[]>();
  const awpHitTicks = new Map<string, number[]>();
  const deathTicks = new Map<string, number[]>();

  for (const f of fires) {
    if (bareWeapon(f.weapon) !== "awp" || roundAt(f.tick) < 0) continue;
    const id = str(f.user_steamid);
    if (!id) continue;
    const list = awpShotTicks.get(id) ?? [];
    list.push(f.tick);
    awpShotTicks.set(id, list);
  }
  for (const h of hurts) {
    if (bareWeapon(h.weapon) !== "awp") continue;
    const id = str(h.attacker_steamid);
    if (!id) continue;
    const list = awpHitTicks.get(id) ?? [];
    list.push(h.tick);
    awpHitTicks.set(id, list);
  }
  for (const d of deaths) {
    const id = str(d.user_steamid);
    if (!id) continue;
    const list = deathTicks.get(id) ?? [];
    list.push(d.tick);
    deathTicks.set(id, list);
  }

  for (const [steamId, shots] of awpShotTicks) {
    const p = players.get(steamId);
    if (!p) continue;
    const hits = (awpHitTicks.get(steamId) ?? []).sort((a, b) => a - b);
    const died = (deathTicks.get(steamId) ?? []).sort((a, b) => a - b);
    const ordered = shots.sort((a, b) => a - b);
    const landed = ordered.map((tick) =>
      hits.some((hit) => hit >= tick && hit - tick <= AWP_HIT_WINDOW),
    );

    ordered.forEach((tick, index) => {
      p.awpShots += 1;
      if (landed[index]) {
        p.awpHits += 1;
        return;
      }
      p.awpMisses += 1;
      const round = roundAt(tick);
      if (died.some((death) => death > tick && death - tick <= AWP_REPEEK_WINDOW)) {
        p.awpMissDeaths += 1;
      }
      const next = ordered[index + 1];
      if (
        next !== undefined &&
        next - tick <= AWP_REPEEK_WINDOW &&
        roundAt(next) === round
      ) {
        p.awpRepeeks += 1;
        if (landed[index + 1]) p.awpRepeekHits += 1;
      }
    });
  }

  const BURST_GAP_TICKS = Math.round(TICK_RATE * 0.4);
  const SHOT_HIT_WINDOW = Math.round(TICK_RATE / 8);
  const gunHitTicks = new Map<string, number[]>();
  for (const h of hurts) {
    const attackerId = str(h.attacker_steamid);
    const victimId = str(h.user_steamid);
    if (!attackerId || attackerId === victimId) continue;
    const key = `${attackerId}|${resolveFiredWeapon(attackerId, num(h.tick), bareWeapon(h.weapon))}`;
    const list = gunHitTicks.get(key) ?? [];
    list.push(h.tick);
    gunHitTicks.set(key, list);
  }

  const gunShots = new Map<string, DemoEvent[]>();
  for (const f of fires) {
    const id = str(f.user_steamid);
    if (!id || !isGun(bareWeapon(f.weapon)) || roundAt(f.tick) < 0) continue;
    const list = gunShots.get(id) ?? [];
    list.push(f);
    gunShots.set(id, list);
  }

  for (const [steamId, shots] of gunShots) {
    const p = players.get(steamId);
    if (!p) continue;
    const ordered = shots.sort((a, b) => a.tick - b.tick);
    ordered.forEach((shot, index) => {
      const weapon = bareWeapon(shot.weapon);
      const use = (p.weaponUse[weapon] ??= emptyWeaponUse());
      use.shots += 1;
      const landed = (gunHitTicks.get(`${steamId}|${weapon}`) ?? []).some(
        (tick) => tick >= shot.tick && tick - shot.tick <= SHOT_HIT_WINDOW,
      );
      const earlier = index > 0 ? ordered[index - 1] : undefined;
      const sameBurst =
        earlier !== undefined &&
        bareWeapon(earlier.weapon) === weapon &&
        shot.tick - earlier.tick <= BURST_GAP_TICKS;
      if (sameBurst) {
        p.sprayShots += 1;
        if (landed) p.sprayHits += 1;
      } else {
        p.firstShots += 1;
        if (landed) p.firstHits += 1;
      }
    });
  }

  const killStreak = new Map<string, number>();
  for (const d of deaths) {
    if (roundAt(d.tick) < 0) continue;
    const attackerId = str(d.attacker_steamid);
    const victimId = str(d.user_steamid);
    const streakRound = roundAt(d.tick);
    const attackerSide = sideIn(d.attacker_team_num, streakRound, attackerId);
    const victimSide = sideIn(d.user_team_num, streakRound, victimId);
    if (attackerId && attackerId !== victimId && attackerSide !== victimSide) {
      const streak = (killStreak.get(attackerId) ?? 0) + 1;
      killStreak.set(attackerId, streak);
      const p = players.get(attackerId);
      if (p && streak > p.bestKillStreak) p.bestKillStreak = streak;
    }
    if (victimId) killStreak.set(victimId, 0);
  }

  const lastTick = kept[kept.length - 1].end.tick;
  const TOTAL_PROPS = ["mvps", "enemies_flashed_total", "utility_damage_total", "total_cash_spent"];
  const totals = readTicks(TOTAL_PROPS, [lastTick]);
  if (totals.length === 0) {
    for (const prop of TOTAL_PROPS) {
      for (const row of readTicks([prop], [lastTick])) {
        const existing = totals.find((r) => r.steamid === row.steamid);
        if (existing) Object.assign(existing, row);
        else totals.push(row);
      }
    }
  }
  for (const row of totals) {
    if (!row.steamid) continue;
    const p = players.get(row.steamid);
    if (!p) continue;
    p.mvps = num(row.mvps);
    p.enemiesFlashed = num(row.enemies_flashed_total);
    p.utilityDamage = num(row.utility_damage_total);
    p.cashSpent = num(row.total_cash_spent);
  }

  if (players.size > 0 && Array.from(players.values()).every((p) => p.mvps === 0)) {
    for (const e of mvpEvents) {
      const p = players.get(str(e.user_steamid) ?? "");
      if (p) p.mvps += 1;
    }
  }

  for (const [objectiveEvents, field] of [
    [plants, "bombsPlanted"],
    [defuses, "bombsDefused"],
  ] as const) {
    for (const e of objectiveEvents) {
      if (roundAt(e.tick) < 0) continue;
      const p = players.get(str(e.user_steamid) ?? "");
      if (p) p[field] += 1;
    }
  }

  const fromName = parseFileName(meta.fileName);

  const clanOf = (squad: "A" | "B"): string => {
    for (const row of snapshotAt(lastTick)) {
      if (row.steamid && squadOf.get(row.steamid) === squad) {
        const clan = str(row.team_clan_name);
        if (clan) return clan;
      }
    }
    return "";
  };

  const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");
  const labelFor = (squad: "A" | "B"): string => {
    const clan = clanOf(squad);
    const teams = fromName.teams;
    if (!teams) return clan;
    if (clan) {
      for (const side of ["A", "B"] as const) {
        if (slug(teams[side]) === slug(clan)) return teams[side];
      }
      return clan;
    }
    return teams[squad];
  };

  const uploadedAt = new Date().toISOString();

  const outputPlayers = Array.from(players.values())
    .map((p) => ({
      ...p,
      teamFlashSeconds: round1(p.teamFlashSeconds),
      selfFlashSeconds: round1(p.selfFlashSeconds),
      enemyFlashSeconds: round1(p.enemyFlashSeconds),
    }))
    .sort((a, b) => b.kills - a.kills);

  if (outputPlayers.length === 0) {
    throw new Error("o parser leu os rounds, mas não encontrou nenhum jogador nesta demo");
  }

  return {
    id: randomUUID(),
    version: SCHEMA_VERSION,
    playedAt: fromName.playedAt ?? uploadedAt,
    playedAtKnown: fromName.playedAt !== null,
    uploadedAt,
    uploadedBy: meta.uploadedBy,
    fileName: meta.fileName,
    fileSizeBytes: statSync(filePath).size,

    map: header.map_name ?? "unknown",
    serverName: header.server_name ?? "",
    demoType: header.client_name ?? "",
    tickRate: TICK_RATE,
    durationSeconds: Math.round(lastTick / TICK_RATE),

    totalRounds: rounds.length,
    score,
    startingSide: { A: sideByRound[0].A, B: sideByRound[0].B },
    clanName: { A: clanOf("A"), B: clanOf("B") },
    teamLabel: { A: labelFor("A"), B: labelFor("B") },

    players: outputPlayers,
    rounds,
  };
}
