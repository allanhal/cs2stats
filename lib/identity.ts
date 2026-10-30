import { cleanNick } from "./format";
import type { Profiles } from "./profiles";
import type { AppConfig, MatchRecord, PlayerMatchStats } from "./types";

export interface Identity {
  canonical: (steamId: string) => string;
  isHidden: (steamId: string) => boolean;
  displayName: (steamId: string, fallback: string) => string;
}

export function makeIdentity(config: AppConfig, profiles: Profiles = {}): Identity {
  const aliases = config.aliases ?? {};
  const hidden = new Set(config.hiddenSteamIds ?? []);
  const names = config.displayNames ?? {};

  const resolved = new Map<string, string>();
  const canonical = (steamId: string): string => {
    const cached = resolved.get(steamId);
    if (cached) return cached;
    let current = steamId;
    const seen = new Set([current]);
    while (aliases[current] && !seen.has(aliases[current])) {
      current = aliases[current];
      seen.add(current);
    }
    resolved.set(steamId, current);
    return current;
  };

  return {
    canonical,
    isHidden: (steamId) => hidden.has(steamId) || hidden.has(canonical(steamId)),

    displayName: (steamId, fallback) => {
      const id = canonical(steamId);
      return names[id] || profiles[id]?.persona || cleanNick(fallback);
    },
  };
}

function mergePlayers(a: PlayerMatchStats, b: PlayerMatchStats): PlayerMatchStats {
  const sumRecords = (x: Record<string, number>, y: Record<string, number>) => {
    const out = { ...x };
    for (const [key, n] of Object.entries(y)) out[key] = (out[key] ?? 0) + n;
    return out;
  };

  const merged: PlayerMatchStats = { ...a };
  for (const key of Object.keys(a) as (keyof PlayerMatchStats)[]) {
    const left = a[key];
    const right = b[key];
    if (typeof left === "number" && typeof right === "number") {
      (merged[key] as number) = left + right;
    }
  }
  merged.steamId = a.steamId;
  merged.name = a.name;
  merged.squad = a.squad;
  merged.multiKills = {
    k1: a.multiKills.k1 + b.multiKills.k1,
    k2: a.multiKills.k2 + b.multiKills.k2,
    k3: a.multiKills.k3 + b.multiKills.k3,
    k4: a.multiKills.k4 + b.multiKills.k4,
    k5: a.multiKills.k5 + b.multiKills.k5,
  };
  merged.clutchesWon = {
    v1: a.clutchesWon.v1 + b.clutchesWon.v1,
    v2: a.clutchesWon.v2 + b.clutchesWon.v2,
    v3: a.clutchesWon.v3 + b.clutchesWon.v3,
    v4: a.clutchesWon.v4 + b.clutchesWon.v4,
    v5: a.clutchesWon.v5 + b.clutchesWon.v5,
  };
  merged.byBuy = Object.fromEntries(
    (["pistol", "eco", "force", "semi", "full"] as const).map((buy) => [
      buy,
      {
        rounds: (a.byBuy?.[buy]?.rounds ?? 0) + (b.byBuy?.[buy]?.rounds ?? 0),
        won: (a.byBuy?.[buy]?.won ?? 0) + (b.byBuy?.[buy]?.won ?? 0),
        kills: (a.byBuy?.[buy]?.kills ?? 0) + (b.byBuy?.[buy]?.kills ?? 0),
        deaths: (a.byBuy?.[buy]?.deaths ?? 0) + (b.byBuy?.[buy]?.deaths ?? 0),
        damage: (a.byBuy?.[buy]?.damage ?? 0) + (b.byBuy?.[buy]?.damage ?? 0),
      },
    ]),
  ) as PlayerMatchStats["byBuy"];
  merged.sniperRounds = {
    pistol: (a.sniperRounds?.pistol ?? 0) + (b.sniperRounds?.pistol ?? 0),
    eco: (a.sniperRounds?.eco ?? 0) + (b.sniperRounds?.eco ?? 0),
    force: (a.sniperRounds?.force ?? 0) + (b.sniperRounds?.force ?? 0),
    semi: (a.sniperRounds?.semi ?? 0) + (b.sniperRounds?.semi ?? 0),
    full: (a.sniperRounds?.full ?? 0) + (b.sniperRounds?.full ?? 0),
  };
  merged.sniperRoundsWon = {
    pistol: (a.sniperRoundsWon?.pistol ?? 0) + (b.sniperRoundsWon?.pistol ?? 0),
    eco: (a.sniperRoundsWon?.eco ?? 0) + (b.sniperRoundsWon?.eco ?? 0),
    force: (a.sniperRoundsWon?.force ?? 0) + (b.sniperRoundsWon?.force ?? 0),
    semi: (a.sniperRoundsWon?.semi ?? 0) + (b.sniperRoundsWon?.semi ?? 0),
    full: (a.sniperRoundsWon?.full ?? 0) + (b.sniperRoundsWon?.full ?? 0),
  };
  merged.bySide = {
    CT: {
      rounds: a.bySide.CT.rounds + b.bySide.CT.rounds,
      kills: a.bySide.CT.kills + b.bySide.CT.kills,
      deaths: a.bySide.CT.deaths + b.bySide.CT.deaths,
      damage: a.bySide.CT.damage + b.bySide.CT.damage,
    },
    T: {
      rounds: a.bySide.T.rounds + b.bySide.T.rounds,
      kills: a.bySide.T.kills + b.bySide.T.kills,
      deaths: a.bySide.T.deaths + b.bySide.T.deaths,
      damage: a.bySide.T.damage + b.bySide.T.damage,
    },
  };
  merged.weapons = sumRecords(a.weapons, b.weapons);
  merged.killsByPlace = sumRecords(a.killsByPlace, b.killsByPlace);
  merged.deathsByPlace = sumRecords(a.deathsByPlace, b.deathsByPlace);
  merged.placesVisited = sumRecords(a.placesVisited ?? {}, b.placesVisited ?? {});
  merged.heatmap = sumRecords(a.heatmap ?? {}, b.heatmap ?? {});

  merged.roundsPlayed = Math.max(a.roundsPlayed, b.roundsPlayed);
  for (const key of ["kastRounds", "survivedRounds", "zeroKillRounds"] as const) {
    merged[key] = Math.min(merged[key], merged.roundsPlayed);
  }
  merged.bySide = {
    CT: { ...merged.bySide.CT, rounds: Math.max(a.bySide.CT.rounds, b.bySide.CT.rounds) },
    T: { ...merged.bySide.T, rounds: Math.max(a.bySide.T.rounds, b.bySide.T.rounds) },
  };
  return merged;
}

export function applyIdentity(match: MatchRecord, identity: Identity): MatchRecord {
  const players: PlayerMatchStats[] = [];
  const index = new Map<string, number>();
  let changed = false;

  for (const player of match.players) {
    if (identity.isHidden(player.steamId)) {
      changed = true;
      continue;
    }
    const steamId = identity.canonical(player.steamId);
    const name = identity.displayName(steamId, player.name);
    if (steamId !== player.steamId || name !== player.name) changed = true;

    const normalised: PlayerMatchStats = { ...player, steamId, name };
    const at = index.get(steamId);
    if (at === undefined) {
      index.set(steamId, players.length);
      players.push(normalised);
    } else {
      players[at] = mergePlayers(players[at], normalised);
    }
  }

  return changed ? { ...match, players } : match;
}
