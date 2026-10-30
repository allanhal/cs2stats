import type { AppConfig, MatchRecord, PlayerMatchStats, Side } from "./types";

export type Result = "win" | "loss" | "tie";

export interface MatchView {
  match: MatchRecord;

  ourSquad: "A" | "B" | null;
  result: Result | null;
  ourScore: number;
  theirScore: number;
  ourPlayers: PlayerMatchStats[];
  theirPlayers: PlayerMatchStats[];

  date: string;

  opponent: string;
}

export function resolveTracked(matches: MatchRecord[], config: AppConfig): Set<string> {
  if (config.trackedSteamIds.length > 0) return new Set(config.trackedSteamIds);
  if (matches.length === 0) return new Set();

  const appearances = new Map<string, number>();
  for (const m of matches) {
    for (const p of m.players) {
      appearances.set(p.steamId, (appearances.get(p.steamId) ?? 0) + 1);
    }
  }

  const seed = Array.from(appearances.entries()).sort(

    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  )[0]?.[0];
  if (!seed) return new Set();

  const together = new Map<string, number>();
  let seedMatches = 0;
  for (const m of matches) {
    const seedPlayer = m.players.find((p) => p.steamId === seed);
    if (!seedPlayer) continue;
    seedMatches++;
    for (const p of m.players) {
      if (p.squad !== seedPlayer.squad) continue;
      together.set(p.steamId, (together.get(p.steamId) ?? 0) + 1);
    }
  }

  const threshold = seedMatches >= 3 ? 2 : 1;
  const core = Array.from(together.entries())
    .filter(([, n]) => n >= threshold)
    .map(([steamId]) => steamId);

  return new Set(core.length > 0 ? core : [seed]);
}

export function detectTeamName(views: MatchView[]): string | null {
  const counts = new Map<string, number>();
  for (const v of views) {
    if (!v.ourSquad) continue;
    const label = v.match.teamLabel[v.ourSquad] || v.match.clanName[v.ourSquad];
    if (!label) continue;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return (
    Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ??
    null
  );
}

export function viewMatch(match: MatchRecord, tracked: Set<string>): MatchView {
  let a = 0;
  let b = 0;
  for (const p of match.players) {
    if (!tracked.has(p.steamId)) continue;
    if (p.squad === "A") a++;
    else b++;
  }
  const ourSquad: "A" | "B" | null = a === 0 && b === 0 ? null : a >= b ? "A" : "B";
  const ourScore = ourSquad ? match.score[ourSquad] : match.score.A;
  const theirScore = ourSquad ? match.score[ourSquad === "A" ? "B" : "A"] : match.score.B;
  const result: Result | null =
    ourSquad === null ? null : ourScore > theirScore ? "win" : ourScore < theirScore ? "loss" : "tie";

  return {
    match,
    ourSquad,
    result,
    ourScore,
    theirScore,
    ourPlayers: match.players.filter((p) => p.squad === ourSquad),
    theirPlayers: match.players.filter((p) => p.squad !== ourSquad),
    date: match.playedAt,
    opponent: ourSquad ? match.teamLabel[ourSquad === "A" ? "B" : "A"] : "",
  };
}

export interface Totals {
  matches: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  roundsWon: number;
  roundsLost: number;
  roundWinRate: number;
  bySide: Record<Side, { won: number; played: number }>;
  pistolRounds: { won: number; played: number };
  longestWinStreak: number;
  currentStreak: { kind: Result | null; length: number };
}

export function totals(views: MatchView[]): Totals {
  const t: Totals = {
    matches: 0,
    wins: 0,
    losses: 0,
    ties: 0,
    winRate: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundWinRate: 0,
    bySide: { CT: { won: 0, played: 0 }, T: { won: 0, played: 0 } },
    pistolRounds: { won: 0, played: 0 },
    longestWinStreak: 0,
    currentStreak: { kind: null, length: 0 },
  };

  for (const v of views) {
    if (!v.ourSquad || !v.result) continue;
    t.matches++;
    if (v.result === "win") t.wins++;
    else if (v.result === "loss") t.losses++;
    else t.ties++;
    t.roundsWon += v.ourScore;
    t.roundsLost += v.theirScore;

    for (const r of v.match.rounds) {
      const ourSide: Side = r.winnerSquad === v.ourSquad ? r.winnerSide : otherSide(r.winnerSide);
      const won = r.winnerSquad === v.ourSquad;
      t.bySide[ourSide].played++;
      if (won) t.bySide[ourSide].won++;
      if (r.buyType[v.ourSquad] === "pistol") {
        t.pistolRounds.played++;
        if (won) t.pistolRounds.won++;
      }
    }
  }

  t.winRate = t.matches ? t.wins / t.matches : 0;
  const totalRounds = t.roundsWon + t.roundsLost;
  t.roundWinRate = totalRounds ? t.roundsWon / totalRounds : 0;

  const chronological = [...views]
    .filter((v) => v.result)
    .sort((a, b) => a.date.localeCompare(b.date));
  let run = 0;
  for (const v of chronological) {
    if (v.result === "win") {
      run++;
      t.longestWinStreak = Math.max(t.longestWinStreak, run);
    } else run = 0;
  }
  let current = 0;
  let kind: Result | null = null;
  for (let i = chronological.length - 1; i >= 0; i--) {
    const r = chronological[i].result!;
    if (kind === null) kind = r;
    if (r !== kind) break;
    current++;
  }
  t.currentStreak = { kind, length: current };

  return t;
}

const otherSide = (s: Side): Side => (s === "CT" ? "T" : "CT");

export interface MapStats {
  map: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  roundsWon: number;
  roundsLost: number;
  bySide: Record<Side, { won: number; played: number }>;
}

export function byMap(views: MatchView[]): MapStats[] {
  const maps = new Map<string, MapStats>();
  for (const v of views) {
    if (!v.ourSquad || !v.result) continue;
    const key = v.match.map;
    let s = maps.get(key);
    if (!s) {
      s = {
        map: key,
        played: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        winRate: 0,
        roundsWon: 0,
        roundsLost: 0,
        bySide: { CT: { won: 0, played: 0 }, T: { won: 0, played: 0 } },
      };
      maps.set(key, s);
    }
    s.played++;
    if (v.result === "win") s.wins++;
    else if (v.result === "loss") s.losses++;
    else s.ties++;
    s.roundsWon += v.ourScore;
    s.roundsLost += v.theirScore;
    for (const r of v.match.rounds) {
      const ourSide: Side = r.winnerSquad === v.ourSquad ? r.winnerSide : otherSide(r.winnerSide);
      s.bySide[ourSide].played++;
      if (r.winnerSquad === v.ourSquad) s.bySide[ourSide].won++;
    }
  }
  for (const s of maps.values()) s.winRate = s.played ? s.wins / s.played : 0;
  return Array.from(maps.values()).sort((a, b) => b.played - a.played || b.winRate - a.winRate);
}

export interface PlayerAggregate {
  steamId: string;
  name: string;
  aliases: string[];
  matches: number;
  wins: number;
  losses: number;
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  flashAssists: number;
  headshotKills: number;
  damage: number;
  utilityDamage: number;
  enemiesFlashed: number;
  mvps: number;
  kastRounds: number;
  survivedRounds: number;
  openingKills: number;
  openingDeaths: number;
  openingKillRoundsWon: number;
  sniperOpeningKills: number;
  sniperOpeningDeaths: number;
  byBuy: PlayerMatchStats["byBuy"];
  sniperRounds: PlayerMatchStats["sniperRounds"];
  sniperRoundsWon: PlayerMatchStats["sniperRoundsWon"];
  sniperKills: number;
  sniperDeaths: number;
  tradeKills: number;
  tradedDeaths: number;
  multiKills: PlayerMatchStats["multiKills"];
  clutchesWon: PlayerMatchStats["clutchesWon"];
  clutchesPlayed: number;
  bombsPlanted: number;
  bombsDefused: number;
  zeroKillRounds: number;
  teamKills: number;
  teamKillDeaths: number;
  teamDamage: number;
  selfDamage: number;
  teamFlashes: number;
  teamFlashSeconds: number;
  selfFlashes: number;
  selfFlashSeconds: number;
  enemyFlashSeconds: number;
  blindKills: number;
  noScopeKills: number;
  throughSmokeKills: number;
  wallbangKills: number;
  bySide: PlayerMatchStats["bySide"];
  weapons: Record<string, number>;
  killsByPlace: Record<string, number>;
  deathsByPlace: Record<string, number>;
  placesVisited: Record<string, number>;
  heatmap: Record<string, number>;

  timeline: {
    matchId: string;
    date: string;
    map: string;
    won: boolean;
    rating: number;
    adr: number;
    kills: number;
    deaths: number;
  }[];

  kd: number;
  kpr: number;
  dpr: number;
  apr: number;
  adr: number;
  hsPercent: number;
  kast: number;
  impact: number;
  rating: number;
  winRate: number;
  openingWinRate: number;
  clutchRate: number;
}

export function aggregatePlayers(
  views: MatchView[],
  options: { tracked?: Set<string>; onlyOurTeam?: boolean } = {},
): PlayerAggregate[] {
  const acc = new Map<string, PlayerAggregate>();

  for (const v of views) {
    const pool = options.onlyOurTeam && v.ourSquad ? v.ourPlayers : v.match.players;
    for (const p of pool) {
      if (options.tracked && options.tracked.size > 0 && !options.tracked.has(p.steamId)) continue;
      let a = acc.get(p.steamId);
      if (!a) {
        a = blankAggregate(p.steamId, p.name);
        acc.set(p.steamId, a);
      }
      if (!a.aliases.includes(p.name)) a.aliases.push(p.name);
      a.name = p.name;
      a.matches++;
      const won = v.ourSquad === p.squad ? v.result === "win" : v.result === "loss";
      const lost = v.ourSquad === p.squad ? v.result === "loss" : v.result === "win";
      if (v.result && v.result !== "tie") {
        if (won) a.wins++;
        else if (lost) a.losses++;
      }
      a.rounds += p.roundsPlayed;
      a.kills += p.kills;
      a.deaths += p.deaths;
      a.assists += p.assists;
      a.flashAssists += p.flashAssists;
      a.headshotKills += p.headshotKills;
      a.damage += p.damage;
      a.utilityDamage += p.utilityDamage;
      a.enemiesFlashed += p.enemiesFlashed;
      a.mvps += p.mvps;
      a.kastRounds += p.kastRounds;
      a.survivedRounds += p.survivedRounds;
      a.openingKills += p.openingKills;
      a.openingDeaths += p.openingDeaths;
      a.openingKillRoundsWon += p.openingKillRoundsWon;
      for (const buy of ["pistol", "eco", "force", "semi", "full"] as const) {
        a.byBuy[buy].rounds += p.byBuy?.[buy]?.rounds ?? 0;
        a.byBuy[buy].won += p.byBuy?.[buy]?.won ?? 0;
        a.byBuy[buy].kills += p.byBuy?.[buy]?.kills ?? 0;
        a.byBuy[buy].deaths += p.byBuy?.[buy]?.deaths ?? 0;
        a.byBuy[buy].damage += p.byBuy?.[buy]?.damage ?? 0;
        a.sniperRounds[buy] += p.sniperRounds?.[buy] ?? 0;
        a.sniperRoundsWon[buy] += p.sniperRoundsWon?.[buy] ?? 0;
      }
      a.tradeKills += p.tradeKills;
      a.tradedDeaths += p.tradedDeaths;
      a.clutchesPlayed += p.clutchesPlayed;
      a.bombsPlanted += p.bombsPlanted;
      a.bombsDefused += p.bombsDefused;
      for (const k of ["k1", "k2", "k3", "k4", "k5"] as const) a.multiKills[k] += p.multiKills[k];
      for (const k of ["v1", "v2", "v3", "v4", "v5"] as const) a.clutchesWon[k] += p.clutchesWon[k];
      for (const side of ["CT", "T"] as Side[]) {
        a.bySide[side].rounds += p.bySide[side].rounds;
        a.bySide[side].kills += p.bySide[side].kills;
        a.bySide[side].deaths += p.bySide[side].deaths;
        a.bySide[side].damage += p.bySide[side].damage;
      }
      for (const key of [
        "zeroKillRounds",
        "teamKills",
        "teamKillDeaths",
        "teamDamage",
        "selfDamage",
        "teamFlashes",
        "teamFlashSeconds",
        "selfFlashes",
        "selfFlashSeconds",
        "enemyFlashSeconds",
        "blindKills",
        "noScopeKills",
        "throughSmokeKills",
        "wallbangKills",
        "sniperOpeningKills",
        "sniperOpeningDeaths",
        "sniperKills",
        "sniperDeaths",
      ] as const) {
        a[key] += p[key] ?? 0;
      }
      for (const [w, n] of Object.entries(p.weapons)) a.weapons[w] = (a.weapons[w] ?? 0) + n;
      for (const [place, n] of Object.entries(p.killsByPlace)) {
        a.killsByPlace[place] = (a.killsByPlace[place] ?? 0) + n;
      }
      for (const [place, n] of Object.entries(p.deathsByPlace)) {
        a.deathsByPlace[place] = (a.deathsByPlace[place] ?? 0) + n;
      }
      for (const [place, n] of Object.entries(p.placesVisited ?? {})) {
        a.placesVisited[place] = (a.placesVisited[place] ?? 0) + n;
      }
      for (const [cell, seconds] of Object.entries(p.heatmap ?? {})) {
        const key = `${v.match.map}|${cell}`;
        a.heatmap[key] = (a.heatmap[key] ?? 0) + seconds;
      }
      a.timeline.push({
        matchId: v.match.id,
        date: v.date,
        map: v.match.map,
        won,
        rating: ratingOf(p),
        adr: p.damage / Math.max(p.roundsPlayed, 1),
        kills: p.kills,
        deaths: p.deaths,
      });
    }
  }

  const list = Array.from(acc.values());
  for (const a of list) {
    a.timeline.sort((x, y) => x.date.localeCompare(y.date));
    derive(a);
  }
  return list.sort((a, b) => b.rating - a.rating);
}

function blankAggregate(steamId: string, name: string): PlayerAggregate {
  return {
    steamId,
    name,
    aliases: [],
    matches: 0,
    wins: 0,
    losses: 0,
    rounds: 0,
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
    byBuy: {
      pistol: { rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 },
      eco: { rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 },
      force: { rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 },
      semi: { rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 },
      full: { rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 },
    },
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
    bySide: { CT: { rounds: 0, kills: 0, deaths: 0, damage: 0 }, T: { rounds: 0, kills: 0, deaths: 0, damage: 0 } },
    weapons: {},
    killsByPlace: {},
    deathsByPlace: {},
    placesVisited: {},
    heatmap: {},
    timeline: [],
    kd: 0,
    kpr: 0,
    dpr: 0,
    apr: 0,
    adr: 0,
    hsPercent: 0,
    kast: 0,
    impact: 0,
    rating: 0,
    winRate: 0,
    openingWinRate: 0,
    clutchRate: 0,
  };
}

export function rating({
  rounds,
  kills,
  deaths,
  assists,
  damage,
  kastRounds,
}: {
  rounds: number;
  kills: number;
  deaths: number;
  assists: number;
  damage: number;
  kastRounds: number;
}): number {
  const r = Math.max(rounds, 1);
  const kpr = kills / r;
  const dpr = deaths / r;
  const apr = assists / r;
  const adr = damage / r;
  const kast = (kastRounds / r) * 100;
  const impact = 2.13 * kpr + 0.42 * apr - 0.41;
  return Math.max(
    0,
    0.0073 * kast + 0.3591 * kpr - 0.5329 * dpr + 0.2372 * impact + 0.0032 * adr + 0.1587,
  );
}

const ratingOf = (p: PlayerMatchStats): number =>
  rating({
    rounds: p.roundsPlayed,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    damage: p.damage,
    kastRounds: p.kastRounds,
  });

function scaleNumbers(node: Record<string, unknown>, factor: number): void {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === "number") {
      node[key] = value * factor;
      continue;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      scaleNumbers(value as Record<string, unknown>, factor);
    }
  }
}

export function averagePlayer(
  players: PlayerAggregate[],
  steamId: string,
  name: string,
): PlayerAggregate | null {
  if (players.length === 0) return null;

  const pooled = blankAggregate(steamId, name);
  const flat = pooled as unknown as Record<string, number>;
  const nested = pooled as unknown as Record<string, Record<string, number>>;

  for (const player of players) {
    const source = player as unknown as Record<string, unknown>;
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "number") {
        flat[key] += value;
        continue;
      }
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const slot = nested[key];
      if (!slot) continue;
      for (const [inner, amount] of Object.entries(value as Record<string, unknown>)) {
        if (typeof amount === "number") {
          slot[inner] = (slot[inner] ?? 0) + amount;
          continue;
        }
        if (!amount || typeof amount !== "object") continue;
        const target = slot[inner] as unknown as Record<string, number> | undefined;
        if (!target) continue;
        for (const [leaf, n] of Object.entries(amount as Record<string, unknown>)) {
          if (typeof n === "number") target[leaf] = (target[leaf] ?? 0) + n;
        }
      }
    }
  }

  scaleNumbers(pooled as unknown as Record<string, unknown>, 1 / players.length);

  derive(pooled);
  return pooled;
}

function derive(a: PlayerAggregate): void {
  const r = Math.max(a.rounds, 1);
  a.kd = a.deaths ? a.kills / a.deaths : a.kills;
  a.kpr = a.kills / r;
  a.dpr = a.deaths / r;
  a.apr = a.assists / r;
  a.adr = a.damage / r;
  a.hsPercent = a.kills ? a.headshotKills / a.kills : 0;
  a.kast = a.kastRounds / r;
  a.impact = 2.13 * a.kpr + 0.42 * a.apr - 0.41;
  a.rating = rating(a);
  const decided = a.wins + a.losses;
  a.winRate = decided ? a.wins / decided : 0;
  a.openingWinRate = a.openingKills ? a.openingKillRoundsWon / a.openingKills : 0;
  a.clutchRate = a.clutchesPlayed
    ? Object.values(a.clutchesWon).reduce((x, y) => x + y, 0) / a.clutchesPlayed
    : 0;
}

export interface MapRoundBreakdown {
  buyType: Record<string, { won: number; played: number }>;
  reasons: Record<string, number>;
}

export function roundBreakdown(views: MatchView[]): MapRoundBreakdown {
  const out: MapRoundBreakdown = { buyType: {}, reasons: {} };
  for (const v of views) {
    if (!v.ourSquad) continue;
    for (const r of v.match.rounds) {
      const type = r.buyType[v.ourSquad];
      const slot: { won: number; played: number } =
        (out.buyType[type] ??= { won: 0, played: 0 });
      const isWin: boolean = r.winnerSquad === v.ourSquad;
      slot.played++;
      if (isWin) slot.won++;
      const key = `${isWin ? "win" : "loss"}:${r.reason}`;
      out.reasons[key] = (out.reasons[key] ?? 0) + 1;
    }
  }
  return out;
}

export interface OpponentRecord {
  opponent: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  roundsWon: number;
  roundsLost: number;
  maps: string[];
  lastPlayed: string;
}

export function headToHead(views: MatchView[]): OpponentRecord[] {
  const byOpponent = new Map<string, OpponentRecord>();
  for (const v of views) {
    if (!v.ourSquad || !v.result) continue;
    const name = v.opponent || "Adversário desconhecido";
    let r = byOpponent.get(name);
    if (!r) {
      r = {
        opponent: name,
        played: 0,
        wins: 0,
        losses: 0,
        ties: 0,
        winRate: 0,
        roundsWon: 0,
        roundsLost: 0,
        maps: [],
        lastPlayed: v.date,
      };
      byOpponent.set(name, r);
    }
    r.played++;
    if (v.result === "win") r.wins++;
    else if (v.result === "loss") r.losses++;
    else r.ties++;
    r.roundsWon += v.ourScore;
    r.roundsLost += v.theirScore;
    if (!r.maps.includes(v.match.map)) r.maps.push(v.match.map);
    if (v.date > r.lastPlayed) r.lastPlayed = v.date;
  }
  for (const r of byOpponent.values()) r.winRate = r.played ? r.wins / r.played : 0;
  return Array.from(byOpponent.values()).sort(
    (a, b) => b.played - a.played || b.lastPlayed.localeCompare(a.lastPlayed),
  );
}

export interface Lineup {
  steamIds: string[];
  names: string[];
  played: number;
  wins: number;
  winRate: number;
}

export function lineups(
  views: MatchView[],
  tracked: Set<string>,
  options: { size?: "full" | "pair"; minPlayed?: number } = {},
): Lineup[] {
  const minPlayed = options.minPlayed ?? 2;
  const groups = new Map<string, Lineup>();
  const nameOf = new Map<string, string>();

  for (const v of views) {
    if (!v.ourSquad || !v.result) continue;
    const ours = v.ourPlayers.filter((p) => tracked.has(p.steamId));
    for (const p of ours) nameOf.set(p.steamId, p.name);
    const ids = ours.map((p) => p.steamId).sort();
    if (ids.length === 0) continue;

    const combos: string[][] =
      options.size === "pair"
        ? ids.flatMap((a, i) => ids.slice(i + 1).map((b) => [a, b]))
        : [ids];

    for (const combo of combos) {
      const key = combo.join("|");
      let g = groups.get(key);
      if (!g) {
        g = { steamIds: combo, names: [], played: 0, wins: 0, winRate: 0 };
        groups.set(key, g);
      }
      g.played++;
      if (v.result === "win") g.wins++;
    }
  }

  return Array.from(groups.values())
    .filter((g) => g.played >= minPlayed)
    .map((g) => ({
      ...g,
      names: g.steamIds.map((id) => nameOf.get(id) ?? id),
      winRate: g.wins / g.played,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);
}

export interface PlaceRecord {
  place: string;
  kills: number;
  deaths: number;
  diff: number;
}

export function callouts(views: MatchView[], map?: string): PlaceRecord[] {
  const places = new Map<string, PlaceRecord>();
  const slot = (place: string) => {
    let s = places.get(place);
    if (!s) {
      s = { place, kills: 0, deaths: 0, diff: 0 };
      places.set(place, s);
    }
    return s;
  };

  for (const v of views) {
    if (!v.ourSquad) continue;
    if (map && v.match.map !== map) continue;
    for (const p of v.ourPlayers) {
      for (const [place, n] of Object.entries(p.killsByPlace)) slot(place).kills += n;
      for (const [place, n] of Object.entries(p.deathsByPlace)) slot(place).deaths += n;
    }
  }

  for (const s of places.values()) s.diff = s.kills - s.deaths;
  return Array.from(places.values()).sort(
    (a, b) => b.kills + b.deaths - (a.kills + a.deaths),
  );
}

export interface Award {
  id: string;
  title: string;
  hint: string;
  tone: "fame" | "shame";
  leader: { steamId: string; name: string; label: string } | null;

  board: { steamId: string; name: string; label: string }[];
}

interface AwardSpec {
  id: string;
  title: string;
  hint: string;
  tone: "fame" | "shame";
  value: (p: PlayerAggregate) => number;
  label: (p: PlayerAggregate) => string;

  count?: (p: PlayerAggregate) => number;

  unit?: (p: PlayerAggregate) => string;

  denominator?: (p: PlayerAggregate) => number;
  minimum?: number;
}

function sniperRoundTotal(p: PlayerAggregate): number {
  return (
    p.sniperRounds.pistol +
    p.sniperRounds.eco +
    p.sniperRounds.force +
    p.sniperRounds.semi +
    p.sniperRounds.full
  );
}

const AWARDS: AwardSpec[] = [
  {
    id: "flash-amigo",
    title: "Lanterna de mão",
    hint: "Cegou os próprios colegas por mais tempo",
    tone: "shame",
    value: (p) => p.teamFlashSeconds,
    count: (p) => p.teamFlashSeconds,
    unit: () => "s cegando aliado",
    label: (p) => `${p.teamFlashSeconds.toFixed(1)}s em ${p.teamFlashes} flashes`,
  },
  {
    id: "auto-flash",
    title: "Cego de nascença",
    hint: "Cegou a si mesmo mais vezes",
    tone: "shame",
    value: (p) => p.selfFlashes,
    count: (p) => p.selfFlashes,
    unit: () => "flashes em si mesmo",
    label: (p) => `${p.selfFlashes}× (${p.selfFlashSeconds.toFixed(1)}s no escuro)`,
  },
  {
    id: "fogo-amigo",
    title: "Fogo amigo",
    hint: "Mais dano causado nos próprios colegas",
    tone: "shame",
    value: (p) => p.teamDamage,
    count: (p) => p.teamDamage,
    unit: () => "de dano em aliado",
    label: (p) => `${p.teamDamage} de dano`,
  },
  {
    id: "boomerang",
    title: "Granada boomerang",
    hint: "Mais dano tomado das próprias granadas",
    tone: "shame",
    value: (p) => p.selfDamage,
    count: (p) => p.selfDamage,
    unit: () => "de dano em si mesmo",
    label: (p) => `${p.selfDamage} de dano em si mesmo`,
  },
  {
    id: "traidor",
    title: "Traidor",
    hint: "Matou mais colegas de time",
    tone: "shame",
    value: (p) => p.teamKills,
    count: (p) => p.teamKills,
    unit: () => "team kills",
    label: (p) => `${p.teamKills} team kill${p.teamKills === 1 ? "" : "s"}`,
  },
  {
    id: "vitima",
    title: "Vítima do próprio time",
    hint: "Morreu mais vezes nas mãos de um colega",
    tone: "shame",
    value: (p) => p.teamKillDeaths,
    count: (p) => p.teamKillDeaths,
    unit: () => "mortes por aliado",
    label: (p) => `${p.teamKillDeaths}× morto por aliado`,
  },
  {
    id: "passageiro",
    title: "Passageiro",
    hint: "Maior proporção de rounds sem dar uma kill",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? p.zeroKillRounds / p.rounds : 0),
    label: (p) => `${pctOf(p.zeroKillRounds / Math.max(p.rounds, 1))} dos rounds (${p.zeroKillRounds})`,
  },
  {
    id: "entregador",
    title: "Entregador",
    hint: "Morreu mais vezes abrindo o round",
    tone: "shame",
    value: (p) => p.openingDeaths,
    count: (p) => p.openingDeaths,
    unit: () => "mortes abrindo o round",
    label: (p) => `${p.openingDeaths} mortes abrindo`,
  },
  {
    id: "awp-de-volta",
    title: "Entrega a AWP",
    hint: "Mais mortes por round em que começou com AWP ou Scout",
    tone: "shame",
    value: (p) => p.sniperDeaths,
    count: (p) => p.sniperDeaths,
    unit: () => "mortes por round de sniper",
    denominator: sniperRoundTotal,
    minimum: 5,
    label: (p) => `${p.sniperDeaths} mortes em ${sniperRoundTotal(p)} rounds com AWP/Scout`,
  },
  {
    id: "saco-de-pancada",
    title: "Saco de pancada",
    hint: "Morreu mais vezes por round",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? p.dpr : 0),
    label: (p) => `${p.dpr.toFixed(2)} mortes por round (${p.deaths})`,
  },
  {
    id: "morte-gratis",
    title: "Morte de graça",
    hint: "Mais mortes que o time não conseguiu trocar",
    tone: "shame",
    value: (p) => p.deaths - p.tradedDeaths,
    count: (p) => p.deaths - p.tradedDeaths,
    unit: () => "mortes sem troca",
    label: (p) => `${p.deaths - p.tradedDeaths} de ${p.deaths} mortes sem troca`,
  },
  {
    id: "peso-morto",
    title: "Peso morto",
    hint: "Menor KAST: rounds sem kill, assistência, sobrevivência nem troca",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? 1 - p.kast : 0),
    label: (p) => `KAST de ${pctOf(p.kast)} em ${p.rounds} rounds`,
  },
  {
    id: "spray",
    title: "Spray and pray",
    hint: "Menor porcentagem de kills na cabeça",
    tone: "shame",
    value: (p) => (p.kills >= 30 ? 1 - p.hsPercent : 0),
    label: (p) => `${pctOf(p.hsPercent)} de HS em ${p.kills} kills`,
  },
  {
    id: "mao-tremula",
    title: "Mão trêmula",
    hint: "Mais clutches perdidos",
    tone: "shame",
    value: (p) => clutchesLost(p),
    count: (p) => clutchesLost(p),
    unit: () => "clutches perdidos",
    label: (p) => `${clutchesLost(p)} de ${p.clutchesPlayed} clutches perdidos`,
  },
  {
    id: "buraco",
    title: "Sempre no mesmo buraco",
    hint: "Lugar do mapa onde mais morreu",
    tone: "shame",
    value: (p) => topEntry(p.deathsByPlace)?.[1] ?? 0,
    count: (p) => topEntry(p.deathsByPlace)?.[1] ?? 0,
    unit: (p) => `mortes em ${topEntry(p.deathsByPlace)?.[0] ?? "lugar nenhum"}`,
    label: (p) => {
      const top = topEntry(p.deathsByPlace);
      return top ? `${top[1]} mortes em ${top[0]}` : "—";
    },
  },
  {
    id: "perna-so",
    title: "Perna só",
    hint: "Maior diferença de kills por round entre CT e TR",
    tone: "shame",
    value: (p) => sideGap(p)?.gap ?? 0,
    label: (p) => {
      const gap = sideGap(p);
      if (!gap) return "—";
      return `${gap.ct.toFixed(2)} kills/round de CT contra ${gap.t.toFixed(2)} de TR`;
    },
  },
  {
    id: "invisivel",
    title: "Invisível",
    hint: "Mais rounds jogados sem levar nenhum MVP",
    tone: "shame",
    value: (p) => (p.mvps === 0 ? p.rounds : 0),
    label: (p) => `0 MVPs em ${p.rounds} rounds`,
  },
  {
    id: "dia-de-cao",
    title: "Dia de cão",
    hint: "Pior partida individual do grupo",
    tone: "shame",
    value: (p) => {
      const worst = worstMatch(p);
      return worst ? Math.max(0, 1.5 - worst.rating) : 0;
    },
    label: (p) => {
      const worst = worstMatch(p);
      if (!worst) return "—";
      return `rating ${worst.rating.toFixed(2)} · ${worst.kills}/${worst.deaths} na ${worst.map}`;
    },
  },
  {
    id: "lanterninha",
    title: "Lanterninha",
    hint: "Pior rating do grupo",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? Math.max(0, 2 - p.rating) : 0),
    label: (p) => `rating ${p.rating.toFixed(2)} em ${p.rounds} rounds`,
  },
  {
    id: "desarmado",
    title: "Desarmado",
    hint: "Pior saldo de kills por morte",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? Math.max(0, 2 - p.kd) : 0),
    label: (p) => `K/D de ${p.kd.toFixed(2)} (${p.kills}/${p.deaths})`,
  },
  {
    id: "pacifista",
    title: "Pacifista",
    hint: "Menor dano médio por round",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? Math.max(0, 100 - p.adr) : 0),
    label: (p) => `${p.adr.toFixed(0)} de ADR`,
  },
  {
    id: "pe-frio",
    title: "Pé frio",
    hint: "Menor porcentagem de vitórias",
    tone: "shame",
    value: (p) => (p.matches >= 5 ? 1 - p.winRate : 0),
    label: (p) => `${pctOf(p.winRate)} em ${p.matches} partidas (${p.losses} derrotas)`,
  },
  {
    id: "festim",
    title: "Granada de festim",
    hint: "Menos dano de utilitário por round",
    tone: "shame",
    value: (p) => (p.rounds >= 20 ? Math.max(0, 10 - p.utilityDamage / p.rounds) : 0),
    label: (p) =>
      `${(p.utilityDamage / Math.max(p.rounds, 1)).toFixed(1)} de dano de granada por round`,
  },
  {
    id: "abridor",
    title: "Abre-alas",
    hint: "Mais primeiras kills do round",
    tone: "fame",
    value: (p) => p.openingKills,
    count: (p) => p.openingKills,
    unit: () => "entry kills",
    label: (p) => `${p.openingKills} entry kills · ${pctOf(p.openingWinRate)} de conversão`,
  },
  {
    id: "sniper-presente",
    title: "Dono da luneta",
    hint: "Mais rounds começados com AWP ou Scout",
    tone: "fame",
    value: sniperRoundTotal,
    count: sniperRoundTotal,
    unit: () => "rounds com AWP/Scout",
    label: (p) => `${sniperRoundTotal(p)} rounds · ${p.sniperRounds.full + p.sniperRounds.semi} em compra cheia`,
  },
  {
    id: "sniper-letal",
    title: "Luneta afiada",
    hint: "Mais kills de sniper por round em que começou com AWP ou Scout",
    tone: "fame",
    value: (p) => p.sniperKills,
    count: (p) => p.sniperKills,
    unit: () => "kills por round de sniper",
    denominator: sniperRoundTotal,
    minimum: 5,
    label: (p) => `${p.sniperKills} kills de sniper em ${sniperRoundTotal(p)} rounds de uso`,
  },
  {
    id: "clutch",
    title: "Sangue frio",
    hint: "Mais clutches ganhos",
    tone: "fame",
    value: (p) => Object.values(p.clutchesWon).reduce((a, b) => a + b, 0),
    count: (p) => Object.values(p.clutchesWon).reduce((a, b) => a + b, 0),
    unit: () => "clutches ganhos",
    label: (p) => {
      const won = Object.values(p.clutchesWon).reduce((a, b) => a + b, 0);
      return `${won} de ${p.clutchesPlayed} situações`;
    },
  },
  {
    id: "adr",
    title: "Britadeira",
    hint: "Maior dano médio por round",
    tone: "fame",
    value: (p) => (p.rounds >= 20 ? p.adr : 0),
    label: (p) => `${p.adr.toFixed(0)} de ADR`,
  },
  {
    id: "mira",
    title: "Mira de cirurgião",
    hint: "Maior porcentagem de kills na cabeça",
    tone: "fame",
    value: (p) => (p.kills >= 20 ? p.hsPercent : 0),
    label: (p) => `${pctOf(p.hsPercent)} de ${p.kills} kills`,
  },
  {
    id: "ace",
    title: "Ace",
    hint: "Rounds em que matou os cinco sozinho",
    tone: "fame",
    value: (p) => p.multiKills.k5,
    count: (p) => p.multiKills.k5,
    unit: () => "aces",
    label: (p) => `${p.multiKills.k5} ace${p.multiKills.k5 === 1 ? "" : "s"}`,
  },
  {
    id: "granadeiro",
    title: "Granadeiro",
    hint: "Mais dano de utilitário",
    tone: "fame",
    value: (p) => p.utilityDamage,
    count: (p) => p.utilityDamage,
    unit: () => "de dano com granada",
    label: (p) => `${p.utilityDamage} de dano com granada`,
  },
  {
    id: "flash-inimigo",
    title: "Apagador",
    hint: "Cegou adversários por mais tempo",
    tone: "fame",
    value: (p) => p.enemyFlashSeconds,
    count: (p) => p.enemyFlashSeconds,
    unit: () => "s de inimigo cego",
    label: (p) => `${p.enemyFlashSeconds.toFixed(1)}s de inimigo cego`,
  },
  {
    id: "smoke",
    title: "Vidente",
    hint: "Mais kills atravessando a fumaça",
    tone: "fame",
    value: (p) => p.throughSmokeKills,
    count: (p) => p.throughSmokeKills,
    unit: () => "kills pelo smoke",
    label: (p) => `${p.throughSmokeKills} kills pelo smoke`,
  },
  {
    id: "wallbang",
    title: "Raio-X",
    hint: "Mais kills atravessando parede",
    tone: "fame",
    value: (p) => p.wallbangKills,
    count: (p) => p.wallbangKills,
    unit: () => "wallbangs",
    label: (p) => `${p.wallbangKills} wallbangs`,
  },
  {
    id: "bomba",
    title: "Esquadrão antibomba",
    hint: "Mais bombas desarmadas",
    tone: "fame",
    value: (p) => p.bombsDefused,
    count: (p) => p.bombsDefused,
    unit: () => "desarmes",
    label: (p) => `${p.bombsDefused} desarmes · ${p.bombsPlanted} plants`,
  },
  {
    id: "craque",
    title: "Craque",
    hint: "Melhor rating do grupo",
    tone: "fame",
    value: (p) => (p.rounds >= 20 ? p.rating : 0),
    label: (p) => `rating ${p.rating.toFixed(2)} em ${p.rounds} rounds`,
  },
  {
    id: "pe-quente",
    title: "Pé quente",
    hint: "Maior porcentagem de vitórias",
    tone: "fame",
    value: (p) => (p.matches >= 5 ? p.winRate : 0),
    label: (p) => `${pctOf(p.winRate)} em ${p.matches} partidas (${p.wins} vitórias)`,
  },
  {
    id: "padrinho",
    title: "Padrinho",
    hint: "Mais assistências por round",
    tone: "fame",
    value: (p) => (p.rounds >= 20 ? p.apr : 0),
    label: (p) => `${p.apr.toFixed(2)} por round (${p.assists} assistências)`,
  },
  {
    id: "mao-de-fada",
    title: "Mão de fada",
    hint: "Mais assistências de flash",
    tone: "fame",
    value: (p) => p.flashAssists,
    count: (p) => p.flashAssists,
    unit: () => "flash assists",
    label: (p) => `${p.flashAssists} flash assists · ${p.enemiesFlashed} inimigos cegos`,
  },
  {
    id: "salva-vidas",
    title: "Salva-vidas",
    hint: "Mais kills vingando a morte de um colega",
    tone: "fame",
    value: (p) => p.tradeKills,
    count: (p) => p.tradeKills,
    unit: () => "trade kills",
    label: (p) => `${p.tradeKills} trade kills`,
  },
  {
    id: "sobrevivente",
    title: "Sobrevivente",
    hint: "Maior porcentagem de rounds terminados vivo",
    tone: "fame",
    value: (p) => (p.rounds >= 20 ? p.survivedRounds / p.rounds : 0),
    label: (p) =>
      `${pctOf(p.survivedRounds / Math.max(p.rounds, 1))} dos rounds (${p.survivedRounds})`,
  },
  {
    id: "trinca",
    title: "Trinca ou mais",
    hint: "Mais rounds com três kills ou mais",
    tone: "fame",
    value: (p) => p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5,
    count: (p) => p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5,
    unit: () => "rounds com 3k ou mais",
    label: (p) =>
      `${p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5} rounds · ${p.multiKills.k3}×3k ${p.multiKills.k4}×4k ${p.multiKills.k5}×5k`,
  },
  {
    id: "heroi",
    title: "Herói de guerra",
    hint: "Mais clutches ganhos contra três ou mais",
    tone: "fame",
    value: (p) => p.clutchesWon.v3 + p.clutchesWon.v4 + p.clutchesWon.v5,
    count: (p) => p.clutchesWon.v3 + p.clutchesWon.v4 + p.clutchesWon.v5,
    unit: () => "clutches contra 3 ou mais",
    label: (p) =>
      `${p.clutchesWon.v3 + p.clutchesWon.v4 + p.clutchesWon.v5} clutches · ${p.clutchesWon.v3}×1v3 ${p.clutchesWon.v4}×1v4 ${p.clutchesWon.v5}×1v5`,
  },
  {
    id: "plantador",
    title: "Plantador",
    hint: "Mais bombas plantadas",
    tone: "fame",
    value: (p) => p.bombsPlanted,
    count: (p) => p.bombsPlanted,
    unit: () => "plants",
    label: (p) => `${p.bombsPlanted} plants`,
  },
  {
    id: "queridinho",
    title: "Queridinho do servidor",
    hint: "Mais MVPs de round",
    tone: "fame",
    value: (p) => p.mvps,
    count: (p) => p.mvps,
    unit: () => "MVPs",
    label: (p) => `${p.mvps} MVPs em ${p.rounds} rounds`,
  },
  {
    id: "casamento",
    title: "Casamento",
    hint: "Arma com que mais matou",
    tone: "fame",
    value: (p) => topEntry(p.weapons)?.[1] ?? 0,
    count: (p) => topEntry(p.weapons)?.[1] ?? 0,
    unit: (p) => `kills de ${topEntry(p.weapons)?.[0] ?? "arma nenhuma"}`,
    label: (p) => {
      const top = topEntry(p.weapons);
      return top ? `${top[1]} kills de ${top[0]}` : "—";
    },
  },
  {
    id: "famas",
    title: "Rei da FAMAS",
    hint: "Mais kills com a arma que ninguém compra",
    tone: "fame",
    value: (p) => p.weapons["famas"] ?? 0,
    label: (p) => {
      const kills = p.weapons["famas"] ?? 0;
      const share = kills / Math.max(p.kills, 1);
      return `${kills} kills de FAMAS, ${(share * 100).toFixed(1)}% das dele`;
    },
  },
  {
    id: "dono-do-pedaco",
    title: "Dono do pedaço",
    hint: "Lugar do mapa onde mais matou",
    tone: "fame",
    value: (p) => topEntry(p.killsByPlace)?.[1] ?? 0,
    count: (p) => topEntry(p.killsByPlace)?.[1] ?? 0,
    unit: (p) => `kills em ${topEntry(p.killsByPlace)?.[0] ?? "lugar nenhum"}`,
    label: (p) => {
      const top = topEntry(p.killsByPlace);
      return top ? `${top[1]} kills em ${top[0]}` : "—";
    },
  },
  {
    id: "na-fe",
    title: "Na fé",
    hint: "Mais kills dadas cego de flash",
    tone: "fame",
    value: (p) => p.blindKills,
    count: (p) => p.blindKills,
    unit: () => "kills no escuro",
    label: (p) => `${p.blindKills} kills no escuro`,
  },
  {
    id: "sem-luneta",
    title: "Sem luneta",
    hint: "Mais kills de noscope",
    tone: "fame",
    value: (p) => p.noScopeKills,
    count: (p) => p.noScopeKills,
    unit: () => "noscopes",
    label: (p) => `${p.noScopeKills} noscopes`,
  },
  {
    id: "dia-inspirado",
    title: "Dia inspirado",
    hint: "Melhor partida individual do grupo",
    tone: "fame",
    value: (p) => bestMatch(p)?.rating ?? 0,
    label: (p) => {
      const best = bestMatch(p);
      if (!best) return "—";
      return `rating ${best.rating.toFixed(2)} · ${best.kills}/${best.deaths} na ${best.map}`;
    },
  },
];

const pctOf = (v: number) => `${Math.round(v * 100)}%`;

const topEntry = (record: Record<string, number>): [string, number] | null => {
  let best: [string, number] | null = null;
  for (const entry of Object.entries(record)) {
    if (!best || entry[1] > best[1]) best = entry;
  }
  return best;
};

const clutchesLost = (p: PlayerAggregate) =>
  p.clutchesPlayed - Object.values(p.clutchesWon).reduce((a, b) => a + b, 0);

const worstMatch = (p: PlayerAggregate) =>
  p.timeline.reduce<PlayerAggregate["timeline"][number] | null>(
    (worst, m) => (!worst || m.rating < worst.rating ? m : worst),
    null,
  );

const bestMatch = (p: PlayerAggregate) =>
  p.timeline.reduce<PlayerAggregate["timeline"][number] | null>(
    (best, m) => (!best || m.rating > best.rating ? m : best),
    null,
  );

const sideGap = (p: PlayerAggregate) => {
  const { CT, T } = p.bySide;
  if (CT.rounds < 15 || T.rounds < 15) return null;
  const ct = CT.kills / CT.rounds;
  const t = T.kills / T.rounds;
  return { ct, t, gap: Math.abs(ct - t) };
};

export type AwardMode = "round" | "total";

const PER_ROUND_MIN_ROUNDS = 20;

const perRound = (value: number) => value.toFixed(value < 0.01 ? 3 : 2);

export function awards(players: PlayerAggregate[], mode: AwardMode = "round"): Award[] {
  return AWARDS.map((spec) => {
    const count = mode === "round" ? spec.count : undefined;

    const board = players
      .map((p) => {
        if (!count) return { p, value: spec.value(p), label: spec.label(p) };
        const denominator = spec.denominator?.(p) ?? p.rounds;
        const minimum = spec.minimum ?? PER_ROUND_MIN_ROUNDS;
        const value = denominator >= minimum ? count(p) / denominator : 0;

        return { p, value, label: `${perRound(value)} ${spec.unit?.(p) ?? ""} por round` };
      })
      .filter((entry) => entry.value > 0)
      .sort((a, b) => b.value - a.value)
      .map((entry) => ({
        steamId: entry.p.steamId,
        name: entry.p.name,
        label: entry.label,
      }));

    return {
      id: spec.id,
      title: spec.title,
      hint: spec.hint,
      tone: spec.tone,
      leader: board[0] ?? null,
      board,
    };
  }).filter((award) => award.leader !== null);
}
