import { rating, type MatchView, type PlayerAggregate } from "./aggregate";
import { mapLabel } from "./format";
import { radarFor } from "./radar";

export type CardTier = "bronze" | "prata" | "ouro" | "lenda";

export type CardEdition =
  | "colorida"
  | "ouro"
  | "prata"
  | "bronze"
  | "mvp"
  | "semana"
  | "sete"
  | "dia"
  | "prime";

export type CardFrame = "classico" | "podio" | "tracejado" | "duplo";

export interface CardStat {
  key: string;
  value: number;
}

export interface PlayerCard {
  steamId: string;
  edition?: CardEdition;
  frame?: CardFrame;
  badge?: string;
  name: string;
  avatar: string;
  overall: number;
  tier: CardTier;
  role: string;
  roleLabel: string;
  map: string;
  mapName: string;
  mapImage: string | null;
  club: string;
  stats: CardStat[];
  matches: number;
  rounds: number;
  kd: number;
  adr: number;
}

const RIFLES = ["ak47", "m4a1", "m4a1_silencer", "galilar", "famas", "sg556", "aug"];

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const scale = (value: number, low: number, high: number) =>
  clamp(Math.round(40 + ((value - low) / (high - low)) * 59), 24, 99);

const blend = (a: number, weightA: number, b: number) =>
  Math.round(a * weightA + b * (1 - weightA));

function tierOf(overall: number): CardTier {
  if (overall >= 88) return "lenda";
  if (overall >= 75) return "ouro";
  if (overall >= 62) return "prata";
  return "bronze";
}

export function roleOf(p: PlayerAggregate): { role: string; roleLabel: string } {
  const rounds = Math.max(p.rounds, 1);
  if (p.kills > 0 && p.sniperKills / p.kills >= 0.22) return { role: "AWP", roleLabel: "Sniper" };
  if (p.openingKills / rounds >= 0.11) return { role: "ENT", roleLabel: "Entry fragger" };
  if (
    (p.utilityDamage / rounds >= 6 || p.flashAssists / rounds >= 0.08) &&
    p.kpr < 0.72
  ) {
    return { role: "SUP", roleLabel: "Suporte" };
  }
  if (p.survivedRounds / rounds >= 0.45) return { role: "ANC", roleLabel: "Âncora" };
  return { role: "RIF", roleLabel: "Rifler" };
}

export function statsOf(p: PlayerAggregate): CardStat[] {
  const rounds = Math.max(p.rounds, 1);
  const multiKills = p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5;
  const rifleKills = RIFLES.reduce((sum, weapon) => sum + (p.weapons[weapon] ?? 0), 0);
  const pistol = p.byBuy.pistol;

  const con = blend(
    scale(p.kast, 0.6, 0.8),
    0.6,
    scale(1 - p.zeroKillRounds / rounds, 0.45, 0.72),
  );
  const clt = blend(scale(p.clutchRate, 0.08, 0.45), 0.6, scale(multiKills / rounds, 0.02, 0.1));
  const imp = scale(p.impact, 0.6, 1.8);
  const pst = pistol.rounds
    ? blend(
        scale(pistol.won / pistol.rounds, 0.3, 0.7),
        0.5,
        scale(pistol.kills / pistol.rounds, 0.4, 1),
      )
    : imp;
  const rif = blend(scale(rifleKills / rounds, 0.22, 0.65), 0.7, scale(p.hsPercent, 0.3, 0.62));
  const awp = p.sniperKills
    ? blend(
        scale(p.sniperKills / rounds, 0.02, 0.35),
        0.7,
        scale(p.sniperOpeningKills / Math.max(p.openingKills, 1), 0.1, 0.5),
      )
    : 24;

  return [
    { key: "CON", value: con },
    { key: "PST", value: pst },
    { key: "CLT", value: clt },
    { key: "RIF", value: rif },
    { key: "IMP", value: imp },
    { key: "AWP", value: awp },
  ];
}

function bestMap(steamId: string, views: MatchView[]): string | null {
  const perMap = new Map<
    string,
    { rounds: number; kills: number; deaths: number; assists: number; damage: number; kast: number }
  >();

  for (const v of views) {
    const stats = v.match.players.find((p) => p.steamId === steamId);
    if (!stats) continue;
    const slot = perMap.get(v.match.map) ?? {
      rounds: 0,
      kills: 0,
      deaths: 0,
      assists: 0,
      damage: 0,
      kast: 0,
    };
    slot.rounds += stats.roundsPlayed;
    slot.kills += stats.kills;
    slot.deaths += stats.deaths;
    slot.assists += stats.assists;
    slot.damage += stats.damage;
    slot.kast += stats.kastRounds;
    perMap.set(v.match.map, slot);
  }

  const entries = Array.from(perMap.entries()).map(([map, slot]) => ({
    map,
    rounds: slot.rounds,
    score: rating({
      rounds: slot.rounds,
      kills: slot.kills,
      deaths: slot.deaths,
      assists: slot.assists,
      damage: slot.damage,
      kastRounds: slot.kast,
    }),
  }));
  if (entries.length === 0) return null;

  const eligible = entries.filter((e) => e.rounds >= 20);
  const pool = eligible.length > 0 ? eligible : entries;
  pool.sort((a, b) => b.score - a.score || b.rounds - a.rounds);
  return pool[0].map;
}

export function buildCard(
  player: PlayerAggregate,
  views: MatchView[],
  options: {
    club: string;
    avatar?: string;
    edition?: CardEdition;
    frame?: CardFrame;
    badge?: string;
  },
): PlayerCard {
  const overall = clamp(Math.round(60 + (player.rating - 1) * 60), 40, 99);
  const { role, roleLabel } = roleOf(player);
  const map = bestMap(player.steamId, views);

  return {
    steamId: player.steamId,
    edition: options.edition,
    frame: options.frame,
    badge: options.badge,
    name: player.name,
    avatar: options.avatar ?? "",
    overall,
    tier: tierOf(overall),
    role,
    roleLabel,
    map: map ?? "",
    mapName: map ? mapLabel(map) : "Sem mapa",
    mapImage: map ? (radarFor(map)?.image ?? null) : null,
    club: options.club,
    stats: statsOf(player),
    matches: player.matches,
    rounds: player.rounds,
    kd: player.kd,
    adr: player.adr,
  };
}
