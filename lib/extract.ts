import { createRequire } from "node:module";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { parseFileName } from "./filename";
import type {
  BuyType,
  MatchRecord,
  PlayerMatchStats,
  RoundRecord,
  Side,
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
export const SCHEMA_VERSION = 7;
const SNIPERS = new Set(["awp", "ssg08", "scar20", "g3sg1"]);
const ECONOMY_SNIPERS = new Set(["awp", "ssg08"]);

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

const round1 = (v: number): number => Math.round(v * 10) / 10;

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

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
    sniperRounds: { pistol: 0, eco: 0, force: 0, semi: 0, full: 0 },
    sniperRoundsWon: { pistol: 0, eco: 0, force: 0, semi: 0, full: 0 },
    sniperKills: 0,
    sniperDeaths: 0,
    tradeKills: 0,
    tradedDeaths: 0,
    multiKills: { k1: 0, k2: 0, k3: 0, k4: 0, k5: 0 },
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
    bySide: { CT: { rounds: 0, kills: 0, deaths: 0, damage: 0 }, T: { rounds: 0, kills: 0, deaths: 0, damage: 0 } },
    weapons: {},
  };
}

export interface ExtractMeta {
  fileName: string;
  uploadedBy: string;
}

export function extractMatch(filePath: string, meta: ExtractMeta): MatchRecord {
  const parser = loadParser();
  const header = parser.parseHeader(filePath);

  const events = parser.parseEvents(
    filePath,
    [
      "player_death",
      "player_hurt",
      "player_blind",
      "player_footstep",
      "round_end",
      "round_freeze_end",
      "round_mvp",
      "bomb_planted",
      "bomb_defused",
    ],
    ["team_num", "last_place_name"],
    ["total_rounds_played", "is_warmup_period"],
  );

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
  const snapshotTicks = Array.from(
    new Set([...allEndTicks, ...freezeTicks.filter((t): t is number => t !== null), ...heatTicks]),
  ).sort((a, b) => a - b);

  const rows = parser.parseTicks(
    filePath,
    [
      "team_num",
      "team_clan_name",
      "team_rounds_total",
      "mvps",
      "enemies_flashed_total",
      "utility_damage_total",
      "CCSPlayerPawn.m_unFreezetimeEndEquipmentValue",
      "inventory",
      "last_place_name",
      "X",
      "Y",
    ],
    snapshotTicks,
  );

  const snapshots = new Map<number, TickRow[]>();
  for (const row of rows) {
    if (!row.steamid) continue;
    const list = snapshots.get(row.tick);
    if (list) list.push(row);
    else snapshots.set(row.tick, [row]);
  }

  const squadOf = new Map<string, "A" | "B">();
  const nameOf = new Map<string, string>();
  for (const row of snapshots.get(allEndTicks[0]) ?? []) {
    const side = sideOf(row.team_num);
    if (!side || !row.steamid) continue;
    squadOf.set(row.steamid, side === "CT" ? "A" : "B");
    if (row.name) nameOf.set(row.steamid, row.name);
  }

  function sideOfSquadAt(tick: number, squad: "A" | "B"): Side | null {
    let ct = 0;
    let t = 0;
    for (const row of snapshots.get(tick) ?? []) {
      if (!row.steamid || squadOf.get(row.steamid) !== squad) continue;
      const side = sideOf(row.team_num);
      if (side === "CT") ct++;
      else if (side === "T") t++;
    }
    if (ct === 0 && t === 0) return null;
    return ct >= t ? "CT" : "T";
  }

  function counterAt(tick: number, squad: "A" | "B"): number | null {
    for (const row of snapshots.get(tick) ?? []) {
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
    const row = snapshots.get(snapshotTick)?.find((r) => r.steamid === steamId);
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
      for (const row of snapshots.get(round.freeze) ?? []) {
        if (!row.steamid) continue;
        const squad = assignLate(row.steamid, round.freeze);
        if (!squad) continue;
        buy[squad] += num(row["CCSPlayerPawn.m_unFreezetimeEndEquipmentValue"]);
        const inventory = row.inventory;
        const hasSniper =
          Array.isArray(inventory) &&
          inventory.some((weapon) =>
            ECONOMY_SNIPERS.has(String(weapon).toLowerCase().replace(/[^a-z0-9]/g, "")),
          );
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
    for (const row of snapshots.get(round.end.tick) ?? []) {
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

  const visitedPlaces: Map<string, Set<string>>[] = kept.map(() => new Map());
  for (const footstep of footsteps) {
    const roundIndex = roundAt(footstep.tick);
    if (roundIndex < 0) continue;
    const steamId = str(footstep.user_steamid);
    const place = str(footstep.user_last_place_name);
    if (!steamId || !place) continue;
    const side = sideOf(footstep.user_team_num) ?? participants[roundIndex].get(steamId);
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
      buy.rounds += 1;
      if (rounds[roundIndex].winnerSquad === p.squad) buy.won += 1;
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
    for (const row of snapshots.get(tick) ?? []) {
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
      p.heatmap[key] = (p.heatmap[key] ?? 0) + 1;
    }
  }

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

    const killsThisRound = new Map<string, number>();
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
      const victimSide = sideOf(d.user_team_num);
      const attackerSide = sideOf(d.attacker_team_num);

      const victim = playerAt(victimId, str(d.user_name), endTick);
      const attacker = playerAt(attackerId, str(d.attacker_name), endTick);

      const teamKill =
        attackerSide != null && attackerSide === victimSide && attackerId !== victimId;

      if (victim && victimId) {
        victim.deaths += 1;
        diedThisRound.add(victimId);
        if (victimSide) victim.bySide[victimSide].deaths += 1;
        victim.byBuy[rounds[roundIndex].buyType[victim.squad]].deaths += 1;
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
        attacker.byBuy[rounds[roundIndex].buyType[attacker.squad]].kills += 1;
        const weapon = str(d.weapon);
        if (weapon) attacker.weapons[weapon] = (attacker.weapons[weapon] ?? 0) + 1;
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
            sideOf(e.user_team_num) === attackerSide,
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
        attacker.openingKills += 1;
        if (attackerSide === winnerSide) attacker.openingKillRoundsWon += 1;
        if (victim) victim.openingDeaths += 1;
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
    }

    for (const [steamId] of map) {
      const p = players.get(steamId);
      if (!p) continue;
      const survived = !diedThisRound.has(steamId);
      if (survived) p.survivedRounds += 1;
      if ((killsThisRound.get(steamId) ?? 0) === 0) p.zeroKillRounds += 1;
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

  for (const h of hurts) {
    const roundIndex = roundAt(h.tick);
    if (roundIndex < 0) continue;
    const attackerId = str(h.attacker_steamid);
    const victimId = str(h.user_steamid);
    const attackerSide = sideOf(h.attacker_team_num);
    const victimSide = sideOf(h.user_team_num);
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
    const throwerSide = sideOf(b.attacker_team_num);
    const victimSide = sideOf(b.user_team_num);

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

  const lastTick = kept[kept.length - 1].end.tick;
  for (const row of snapshots.get(lastTick) ?? []) {
    if (!row.steamid) continue;
    const p = players.get(row.steamid);
    if (!p) continue;
    p.mvps = num(row.mvps);
    p.enemiesFlashed = num(row.enemies_flashed_total);
    p.utilityDamage = num(row.utility_damage_total);
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
    for (const row of snapshots.get(lastTick) ?? []) {
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

    players: Array.from(players.values())
      .filter((p) => p.roundsPlayed > 0)
      .map((p) => ({
        ...p,
        teamFlashSeconds: round1(p.teamFlashSeconds),
        selfFlashSeconds: round1(p.selfFlashSeconds),
        enemyFlashSeconds: round1(p.enemyFlashSeconds),
      }))
      .sort((a, b) => b.kills - a.kills),
    rounds,
  };
}
