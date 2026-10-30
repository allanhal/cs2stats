import { aggregatePlayers, type MatchView, type PlayerAggregate } from "./aggregate";
import { insights } from "./insights";
import type { Dataset } from "./data";
import type { BuyType, PlayerMatchStats, RoundRecord, Side } from "./types";

export const EXPORT_VERSION = 1;

const round2 = (v: number) => Math.round(v * 100) / 100;

function sideOf(round: RoundRecord, squad: "A" | "B"): Side {
  if (round.winnerSquad === squad) return round.winnerSide;
  return round.winnerSide === "CT" ? "T" : "CT";
}

function rates(stats: {
  rounds: number;
  kills: number;
  deaths: number;
  damage: number;
  kastRounds?: number;
}) {
  const rounds = Math.max(stats.rounds, 1);
  return {
    kd: round2(stats.kills / Math.max(stats.deaths, 1)),
    kpr: round2(stats.kills / rounds),
    dpr: round2(stats.deaths / rounds),
    adr: round2(stats.damage / rounds),
    ...(stats.kastRounds === undefined ? {} : { kast: round2(stats.kastRounds / rounds) }),
  };
}

const MATCH_STATS_OMITTED = [
  "heatmap",
  "placesVisited",
  "killsByPlace",
  "deathsByPlace",
  "weaponUse",
  "byBuy",
  "byEnemyBuy",
  "hitsBySide",
  "hitDamage",
  "sniperRounds",
  "sniperRoundsWon",
] as const;

function matchStats(stats: PlayerMatchStats): Partial<PlayerMatchStats> {
  const omitted = new Set<string>(MATCH_STATS_OMITTED);
  return Object.fromEntries(
    Object.entries(stats).filter(([key]) => !omitted.has(key)),
  ) as Partial<PlayerMatchStats>;
}

function outcome(view: MatchView, squad: "A" | "B"): "win" | "loss" | "tie" {
  const ours = view.match.score[squad];
  const theirs = view.match.score[squad === "A" ? "B" : "A"];
  if (ours > theirs) return "win";
  if (ours < theirs) return "loss";
  return "tie";
}

function matchRounds(view: MatchView, squad: "A" | "B") {
  const theirs = squad === "A" ? "B" : "A";
  return view.match.rounds.map((round) => ({
    number: round.number,
    side: sideOf(round, squad),
    won: round.winnerSquad === squad,
    reason: round.reason,
    bombPlanted: round.bombPlanted,
    ourBuy: round.buyType?.[squad] as BuyType | undefined,
    theirBuy: round.buyType?.[theirs] as BuyType | undefined,
    openedBy: round.openingSquad === squad ? "us" : round.openingSquad ? "them" : null,
    score: round.score,
  }));
}

function matchEntry(view: MatchView, stats: PlayerMatchStats, rating: number) {
  const compact = matchStats(stats);
  const teammates = view.match.players.filter(
    (p) => p.squad === stats.squad && p.steamId !== stats.steamId,
  );
  const opponents = view.match.players.filter((p) => p.squad !== stats.squad);
  const row = (p: PlayerMatchStats) => ({
    steamId: p.steamId,
    name: p.name,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    adr: round2(p.damage / Math.max(p.roundsPlayed, 1)),
  });

  return {
    matchId: view.match.id,
    playedAt: view.match.playedAt,
    playedAtKnown: view.match.playedAtKnown,
    map: view.match.map,
    demoType: view.match.demoType,
    durationSeconds: view.match.durationSeconds,
    totalRounds: view.match.totalRounds,
    result: outcome(view, stats.squad),
    ourScore: view.match.score[stats.squad],
    theirScore: view.match.score[stats.squad === "A" ? "B" : "A"],
    opponent: view.match.teamLabel?.[stats.squad === "A" ? "B" : "A"] ?? "",
    startingSide: view.match.startingSide?.[stats.squad] ?? null,
    rating,
    ...rates({
      rounds: stats.roundsPlayed,
      kills: stats.kills,
      deaths: stats.deaths,
      damage: stats.damage,
      kastRounds: stats.kastRounds,
    }),
    stats: compact,
    teammates: teammates.map(row),
    opponents: opponents.map(row),
    rounds: matchRounds(view, stats.squad),
  };
}


function mapBreakdown(
  appearances: { view: MatchView; stats: PlayerMatchStats }[],
) {
  const perMap = new Map<
    string,
    {
      map: string;
      matches: number;
      wins: number;
      rounds: number;
      kills: number;
      deaths: number;
      assists: number;
      damage: number;
      kastRounds: number;
      openingKills: number;
      openingDeaths: number;
    }
  >();

  for (const { view, stats } of appearances) {
    const slot =
      perMap.get(view.match.map) ??
      {
        map: view.match.map,
        matches: 0,
        wins: 0,
        rounds: 0,
        kills: 0,
        deaths: 0,
        assists: 0,
        damage: 0,
        kastRounds: 0,
        openingKills: 0,
        openingDeaths: 0,
      };
    slot.matches++;
    slot.rounds += stats.roundsPlayed;
    slot.kills += stats.kills;
    slot.deaths += stats.deaths;
    slot.assists += stats.assists;
    slot.damage += stats.damage;
    slot.kastRounds += stats.kastRounds;
    slot.openingKills += stats.openingKills;
    slot.openingDeaths += stats.openingDeaths;
    if (outcome(view, stats.squad) === "win") slot.wins++;
    perMap.set(view.match.map, slot);
  }

  return Array.from(perMap.values())
    .sort((a, b) => b.rounds - a.rounds)
    .map((slot) => ({ ...slot, ...rates(slot) }));
}

function teamBaseline(group: PlayerAggregate[], steamId: string) {
  const rounds = group.reduce((sum, p) => sum + p.rounds, 0);
  const weighted = (pick: (p: PlayerAggregate) => number) =>
    rounds > 0 ? round2(group.reduce((sum, p) => sum + pick(p) * p.rounds, 0) / rounds) : 0;
  const ratio = (
    top: (p: PlayerAggregate) => number,
    bottom: (p: PlayerAggregate) => number,
  ) => {
    const total = group.reduce((sum, p) => sum + bottom(p), 0);
    return total > 0 ? round2(group.reduce((sum, p) => sum + top(p), 0) / total) : 0;
  };

  return {
    players: group.length,
    rounds,
    average: {
      rating: weighted((p) => p.rating),
      impact: weighted((p) => p.impact),
      kpr: weighted((p) => p.kpr),
      dpr: weighted((p) => p.dpr),
      adr: weighted((p) => p.adr),
      kast: weighted((p) => p.kast),
      hsPercent: weighted((p) => p.hsPercent),
      accuracy: weighted((p) => p.accuracy),
      firstShotAccuracy: weighted((p) => p.firstShotAccuracy),
      sprayAccuracy: weighted((p) => p.sprayAccuracy),
      openingKillsPerRound: weighted((p) => p.openingKills / Math.max(p.rounds, 1)),
      openingDeathsPerRound: weighted((p) => p.openingDeaths / Math.max(p.rounds, 1)),
      tradeKillsPerRound: weighted((p) => p.tradeKills / Math.max(p.rounds, 1)),
      utilityDamagePerRound: weighted((p) => p.utilityDamage / Math.max(p.rounds, 1)),
      enemyFlashSecondsPerRound: weighted((p) => p.enemyFlashSeconds / Math.max(p.rounds, 1)),
      lifeSeconds: weighted((p) => p.lifeSeconds),
      ttkMs: ratio((p) => p.duelMs, (p) => p.duelKills),
      reactionTimeMs: ratio((p) => p.reactionMs, (p) => p.reactionKills),
      equipAverage: weighted((p) => p.equipAverage),
    },
    teammates: group.map((p) => ({
      steamId: p.steamId,
      name: p.name,
      self: p.steamId === steamId,
      matches: p.matches,
      rounds: p.rounds,
      rating: round2(p.rating),
      kd: round2(p.kd),
      adr: round2(p.adr),
      kast: round2(p.kast),
      hsPercent: round2(p.hsPercent),
      openingKills: p.openingKills,
      openingDeaths: p.openingDeaths,
      clutchesWon: Object.values(p.clutchesWon).reduce((a, b) => a + b, 0),
      clutchesPlayed: p.clutchesPlayed,
      topFragMatches: p.topFragMatches,
      topDeathMatches: p.topDeathMatches,
    })),
  };
}

const README = [
  "Este arquivo é a exportação completa das estatísticas de um jogador de CS2 coletadas pelo CS2 Stats a partir das demos das partidas do grupo.",
  "Cole o arquivo numa IA e peça uma análise: o que já é ponto forte, o que custa rounds e o que treinar primeiro.",
  "career traz os números somados de todas as partidas; matches traz cada partida separada, com os rounds em ordem; teamBaseline traz a média do grupo e cada companheiro, para comparar em vez de julgar o número solto.",
  "Tudo que é tempo está em milissegundos quando o nome termina em Ms e em segundos quando termina em Seconds. Valores de dinheiro são dólares do jogo.",
  "Taxas e porcentagens estão como fração de 0 a 1.",
  "Nada aqui vem da API da Valve: é tudo lido da própria demo, então rank e MMR não existem neste arquivo.",
  "Para o arquivo não ficar gigante, cada partida traz só os números do jogador e os rounds; o detalhe por arma, por lugar do mapa e por tipo de compra aparece somado em career.",
];

const GLOSSARY: Record<string, string> = {
  rating: "Rating estilo HLTV 1.0 calculado pelo CS2 Stats: 1.00 é a média esperada.",
  impact: "Peso das kills e assistências no round, na fórmula 2.13*KPR + 0.42*APR - 0.41.",
  kpr: "Kills por round.",
  dpr: "Mortes por round.",
  apr: "Assistências por round.",
  adr: "Dano médio por round.",
  kast: "Fração dos rounds em que matou, assistiu, sobreviveu ou foi trocado.",
  kastRounds: "Quantidade de rounds que contaram para o KAST.",
  openingKills: "Primeiras kills do round (entry).",
  openingDeaths: "Mortes como primeira baixa do round.",
  openingKillRoundsWon: "Rounds ganhos depois de fazer a primeira kill.",
  openingDeathRoundsWon: "Rounds ganhos mesmo tendo morrido primeiro.",
  tradeKills: "Kills que vingaram a morte de um companheiro.",
  tradedDeaths: "Mortes que um companheiro conseguiu vingar.",
  multiKills: "Rounds por número de kills: k1 até k5.",
  multiKillRoundsLost: "Rounds com 3+ kills em que o time perdeu.",
  carriedLosses: "Derrotas com rating 1.2 ou mais.",
  topFragMatches:
    "Em career, partidas terminadas como quem mais matou entre os dez jogadores; em teamBaseline, só entre os companheiros de time.",
  topDeathMatches:
    "Em career, partidas terminadas como quem mais morreu entre os dez jogadores; em teamBaseline, só entre os companheiros de time.",
  byBuy: "Desempenho pelo tipo de compra do próprio time no round.",
  byEnemyBuy: "Desempenho pelo tipo de compra do time adversário no round.",
  buyTypes: "pistol, eco, force, semi e full descrevem o investimento do time no round.",
  clutchesWon: "Clutches ganhos por número de inimigos vivos, v1 a v5.",
  clutchesPlayed: "Rounds em que ficou sozinho contra um ou mais inimigos.",
  duelMs: "Soma do tempo entre ver o inimigo e matá-lo; divida por duelKills para o TTK.",
  reactionMs: "Soma do tempo entre levar o primeiro tiro e matar quem atirou.",
  firstShots: "Primeiros tiros de cada rajada; firstHits são os que acertaram.",
  sprayShots: "Tiros seguintes da rajada; sprayHits são os que acertaram.",
  hits: "Acertos por região do corpo.",
  hitDamage: "Dano por região do corpo.",
  weaponUse: "Por arma: shots, hits, headshots, damage e kills.",
  weapons: "Kills por arma.",
  killsByPlace: "Kills por lugar do mapa, com o nome que o mapa usa.",
  deathsByPlace: "Mortes por lugar do mapa.",
  placesVisited: "Segundos passados em cada lugar do mapa.",
  postPlantRounds: "Rounds jogados depois da bomba plantada, como TR.",
  retakeRounds: "Rounds de retake, como CT com a bomba plantada.",
  saveRounds: "Rounds perdidos em que sobreviveu guardando a arma.",
  saveNextWon: "Rounds seguintes ganhos depois de um save.",
  equipValue: "Soma do valor do equipamento no começo dos rounds.",
  cashSpent: "Dinheiro gasto no total.",
  damagePerThousand: "Dano causado por mil dólares gastos.",
  lifeMs: "Soma do tempo de vida nos rounds; lifeSeconds é a média por round.",
  bestKillStreak: "Maior sequência de kills sem morrer.",
  zeroKillRounds: "Rounds sem nenhuma kill.",
  zeroDamageRounds: "Rounds sem causar dano.",
  teamFlashSeconds: "Segundos de cegueira causados em companheiros.",
  enemyFlashSeconds: "Segundos de cegueira causados em inimigos.",
  awpRepeeks: "Vezes que voltou a aparecer no mesmo ângulo com a AWP.",
  rounds: "Em matches[].rounds, a ordem é a do jogo; score é o placar depois do round.",
};

export interface PlayerExport {
  readme: string[];
  glossary: Record<string, string>;
  meta: {
    source: string;
    exportVersion: number;
    generatedAt: string;
    team: string;
  };
  player: {
    steamId: string;
    name: string;
    aliases: string[];
    matches: number;
    rounds: number;
    firstMatch: string | null;
    lastMatch: string | null;
  };
  career: PlayerAggregate;
  teamBaseline: ReturnType<typeof teamBaseline>;
  maps: ReturnType<typeof mapBreakdown>;
  matches: ReturnType<typeof matchEntry>[];
  teamInsights: ReturnType<typeof insights>;
}

export function buildPlayerExport(
  steamId: string,
  { views, tracked, config }: Dataset,
): PlayerExport | null {
  const [player] = aggregatePlayers(views).filter((p) => p.steamId === steamId);
  if (!player) return null;

  const appearances = views
    .map((view) => ({ view, stats: view.match.players.find((p) => p.steamId === steamId) }))
    .filter((entry): entry is { view: MatchView; stats: PlayerMatchStats } => Boolean(entry.stats))
    .sort((a, b) => a.view.date.localeCompare(b.view.date));

  const group = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const ratingByMatch = new Map(player.timeline.map((m) => [m.matchId, m.rating]));

  const matches = appearances.map(({ view, stats }) =>
    matchEntry(view, stats, round2(ratingByMatch.get(view.match.id) ?? 0)),
  );

  return {
    readme: README,
    glossary: GLOSSARY,
    meta: {
      source: "cs2stats",
      exportVersion: EXPORT_VERSION,
      generatedAt: new Date().toISOString(),
      team: config.teamName,
    },
    player: {
      steamId: player.steamId,
      name: player.name,
      aliases: player.aliases,
      matches: player.matches,
      rounds: player.rounds,
      firstMatch: appearances[0]?.view.match.playedAt ?? null,
      lastMatch: appearances[appearances.length - 1]?.view.match.playedAt ?? null,
    },
    career: player,
    teamBaseline: teamBaseline(group, steamId),
    maps: mapBreakdown(appearances),
    matches,
    teamInsights: insights(views),
  };
}
