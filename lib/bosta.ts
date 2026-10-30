import {
  aggregatePlayers,
  awards,
  bestPlayers,
  lobbyImpact,
  viewsIn,
  worstPlayers,
  type MatchView,
  type Period,
} from "@/lib/aggregate";
import type { Profiles } from "@/lib/profiles";

export type HeroTone = "pior" | "melhor";

export interface HeroCard {
  tone: HeroTone;
  steamId: string;
  name: string;
  club: string;
  avatar: string;
  kd: number;
  kast: number;
  kills: number;
  deaths: number;
  winRate: number;
  rating: number;
  titles: { title: string; label: string }[];
}

export const HERO_TONES: { key: HeroTone; label: string; heading: string }[] = [
  { key: "pior", label: "Pior jogador", heading: "Cartinha do pior jogador" },
  { key: "melhor", label: "Melhor jogador", heading: "Cartinha do melhor jogador" },
];

export function heroToneOf(value: string | undefined | null): HeroTone | null {
  return HERO_TONES.find((t) => t.key === value)?.key ?? null;
}

export const BOSTA_PERIODS: { key: Period; label: string; min: number }[] = [
  { key: "geral", label: "Geral", min: 5 },
  { key: "semana", label: "Esta semana", min: 3 },
  { key: "7dias", label: "Últimos 7 dias", min: 3 },
  { key: "24h", label: "Últimas 24h", min: 2 },
];

export function bostaPeriodOf(value: string | undefined | null) {
  return BOSTA_PERIODS.find((p) => p.key === value) ?? BOSTA_PERIODS[0];
}

export function buildHeroCard(
  views: MatchView[],
  tracked: Set<string>,
  options: { club: string; profiles: Profiles; period?: Period; tone: HeroTone },
): HeroCard | null {
  const period = bostaPeriodOf(options.period);
  const scoped = viewsIn(views, period.key);
  const players = aggregatePlayers(scoped, { tracked, onlyOurTeam: true });
  const lobby = lobbyImpact(scoped, tracked, {
    minPlayed: period.min,
    minAbsent: period.min,
  });
  const rank = options.tone === "pior" ? worstPlayers : bestPlayers;
  const chosen = rank(players, lobby, { minMatches: period.min })[0];
  if (!chosen) return null;

  const full = players.find((p) => p.steamId === chosen.steamId);
  if (!full) return null;

  const wanted = options.tone === "pior" ? "shame" : "fame";

  return {
    tone: options.tone,
    steamId: full.steamId,
    name: full.name,
    club: options.club,
    avatar: options.profiles[full.steamId]?.avatar ?? "",
    kd: full.kd,
    kast: full.kast,
    kills: full.kills,
    deaths: full.deaths,
    winRate: full.winRate,
    rating: full.rating,
    titles: awards(players)
      .filter((a) => a.tone === wanted && a.leader?.steamId === full.steamId)
      .map((a) => ({ title: a.title, label: a.leader?.label ?? "" })),
  };
}
