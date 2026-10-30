import { aggregatePlayers, type MatchView, type PlayerAggregate } from "./aggregate";
import { roleOf, type CardStat, type PlayerCard } from "./card";
import { mapLabel } from "./format";
import { radarFor } from "./radar";

export const PRIME_MIN_ROUNDS = 12;

const RIFLES = ["ak47", "m4a1", "m4a1_silencer", "galilar", "famas", "sg556", "aug"];

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));

const scale = (value: number, low: number, high: number) =>
  clamp(Math.round(40 + ((value - low) / (high - low)) * 59), 24, 99);

const blend = (a: number, weightA: number, b: number) =>
  Math.round(a * weightA + b * (1 - weightA));

export interface PrimeStat extends CardStat {
  label: string;
  hint: string;
  matchId: string;
  date: string;
  map: string;
  mapName: string;
}

export interface PrimeMark {
  label: string;
  value: string;
  matchId: string;
  date: string;
  map: string;
  mapName: string;
}

export interface PrimeCard extends PlayerCard {
  stats: PrimeStat[];
  marks: PrimeMark[];
  peakMatchId: string;
  peakDate: string;
  peakRating: number;
  considered: number;
}

const ATTRIBUTES: {
  key: string;
  label: string;
  hint: string;
  value: (p: PlayerAggregate) => number;
}[] = [
  {
    key: "CON",
    label: "Consistência",
    hint: "O maior KAST que ele já fechou, com os rounds em que fez alguma coisa",
    value: (p) => {
      const rounds = Math.max(p.rounds, 1);
      return blend(
        scale(p.kast, 0.78, 1),
        0.5,
        scale(1 - p.zeroKillRounds / rounds, 0.55, 0.9),
      );
    },
  },
  {
    key: "PST",
    label: "Pistol round",
    hint: "A melhor noite dele nos rounds de pistola",
    value: (p) => {
      const pistol = p.byBuy.pistol;
      if (!pistol.rounds) return 24;
      return blend(
        scale(pistol.kills / pistol.rounds, 0.9, 3.2),
        0.7,
        scale(pistol.won / pistol.rounds, 0.4, 1),
      );
    },
  },
  {
    key: "CLT",
    label: "Clutch",
    hint: "A maior sequência de kills sem morrer e os rounds de 3+ kills",
    value: (p) => {
      const rounds = Math.max(p.rounds, 1);
      const multiKills = p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5;
      return blend(scale(p.bestKillStreak, 3, 12), 0.6, scale(multiKills / rounds, 0.04, 0.3));
    },
  },
  {
    key: "RIF",
    label: "Rifle",
    hint: "O pico de kills de rifle por round, com o aproveitamento de cabeça",
    value: (p) => {
      const rounds = Math.max(p.rounds, 1);
      const rifleKills = RIFLES.reduce((sum, weapon) => sum + (p.weapons[weapon] ?? 0), 0);
      return blend(scale(rifleKills / rounds, 0.5, 1.1), 0.65, scale(p.hsPercent, 0.5, 0.92));
    },
  },
  {
    key: "IMP",
    label: "Impacto",
    hint: "A partida em que mais kills e assistências dele decidiram round",
    value: (p) => scale(p.impact, 1.4, 3.1),
  },
  {
    key: "AWP",
    label: "Sniper",
    hint: "O pico de kills de AWP ou Scout por round",
    value: (p) => (p.sniperKills ? scale(p.sniperKills / Math.max(p.rounds, 1), 0.02, 0.6) : 24),
  },
];

const MARKS: { label: string; value: (p: PlayerAggregate) => number; text: (v: number) => string }[] =
  [
    { label: "Rating", value: (p) => p.rating, text: (v) => v.toFixed(2) },
    { label: "K/D", value: (p) => p.kd, text: (v) => v.toFixed(2) },
    { label: "ADR", value: (p) => p.adr, text: (v) => v.toFixed(0) },
    { label: "KAST", value: (p) => p.kast, text: (v) => `${Math.round(v * 100)}%` },
    { label: "Kills", value: (p) => p.kills, text: (v) => String(v) },
    { label: "Sequência de kills", value: (p) => p.bestKillStreak, text: (v) => String(v) },
    {
      label: "Rounds de 3+ kills",
      value: (p) => p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5,
      text: (v) => String(v),
    },
    { label: "Dano de utilitário", value: (p) => p.utilityDamage, text: (v) => String(Math.round(v)) },
  ];

const overallOf = (rating: number) =>
  clamp(Math.round(70 + ((rating - 1.25) / 1.55) * 29), 55, 99);

export interface PrimeMatch {
  view: MatchView;
  player: PlayerAggregate;
}

export function primeMatches(
  views: MatchView[],
  options: { tracked?: Set<string>; onlyOurTeam?: boolean } = {},
): Map<string, PrimeMatch[]> {
  const index = new Map<string, PrimeMatch[]>();

  for (const view of views) {
    for (const player of aggregatePlayers([view], options)) {
      const list = index.get(player.steamId) ?? [];
      list.push({ view, player });
      index.set(player.steamId, list);
    }
  }

  return index;
}

export function buildPrimeCard(
  career: PlayerAggregate,
  played: PrimeMatch[],
  options: { club: string; avatar?: string },
): PrimeCard | null {
  const long = played.filter((m) => m.player.rounds >= PRIME_MIN_ROUNDS);
  const pool = long.length > 0 ? long : played;
  if (pool.length === 0) return null;

  const peak = pool.reduce((best, m) => (m.player.rating > best.player.rating ? m : best));
  const where = (m: PrimeMatch) => ({
    matchId: m.view.match.id,
    date: m.view.match.playedAt,
    map: m.view.match.map,
    mapName: mapLabel(m.view.match.map),
  });

  const stats: PrimeStat[] = ATTRIBUTES.map((attribute) => {
    const top = pool.reduce((best, m) =>
      attribute.value(m.player) > attribute.value(best.player) ? m : best,
    );
    return {
      key: attribute.key,
      label: attribute.label,
      hint: attribute.hint,
      value: attribute.value(top.player),
      ...where(top),
    };
  });

  const marks: PrimeMark[] = MARKS.map((mark) => {
    const top = pool.reduce((best, m) => (mark.value(m.player) > mark.value(best.player) ? m : best));
    return {
      label: mark.label,
      value: mark.text(mark.value(top.player)),
      ...where(top),
    };
  });

  const bestKd = Math.max(...pool.map((m) => m.player.kd));
  const bestAdr = Math.max(...pool.map((m) => m.player.adr));
  const overall = overallOf(peak.player.rating);
  const { role, roleLabel } = roleOf(career);

  return {
    steamId: career.steamId,
    edition: "prime",
    frame: "duplo",
    badge: "PRIME",
    name: career.name,
    avatar: options.avatar ?? "",
    overall,
    tier: overall >= 88 ? "lenda" : overall >= 75 ? "ouro" : "prata",
    role,
    roleLabel,
    map: peak.view.match.map,
    mapName: mapLabel(peak.view.match.map),
    mapImage: radarFor(peak.view.match.map)?.image ?? null,
    club: options.club,
    stats,
    marks,
    matches: pool.length,
    rounds: pool.reduce((sum, m) => sum + m.player.rounds, 0),
    kd: bestKd,
    adr: bestAdr,
    peakMatchId: peak.view.match.id,
    peakDate: peak.view.match.playedAt,
    peakRating: peak.player.rating,
    considered: pool.length,
  };
}

export function primeCards(
  views: MatchView[],
  tracked: Set<string>,
  options: { club: string; avatars: Record<string, string | undefined> },
): PrimeCard[] {
  const careers = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const index = primeMatches(views, { tracked, onlyOurTeam: true });

  return careers
    .map((career) =>
      buildPrimeCard(career, index.get(career.steamId) ?? [], {
        club: options.club,
        avatar: options.avatars[career.steamId],
      }),
    )
    .filter((card): card is PrimeCard => card !== null)
    .sort((a, b) => b.overall - a.overall || b.peakRating - a.peakRating);
}
