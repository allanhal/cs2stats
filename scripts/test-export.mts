import assert from "node:assert/strict";
import { viewMatch } from "../lib/aggregate";
import type { Dataset } from "../lib/data";
import { buildPlayerExport } from "../lib/player-export";
import type {
  AppConfig,
  BuyType,
  MatchRecord,
  PlayerMatchStats,
  RoundRecord,
  Side,
} from "../lib/types";

const zeroBuy = () => ({ rounds: 0, won: 0, kills: 0, deaths: 0, damage: 0 });
const zeroByBuy = () => ({
  pistol: zeroBuy(),
  eco: zeroBuy(),
  force: zeroBuy(),
  semi: zeroBuy(),
  full: zeroBuy(),
});
const zeroHits = () => ({ head: 0, chest: 0, stomach: 0, arms: 0, legs: 0, other: 0 });

function player(
  steamId: string,
  name: string,
  squad: "A" | "B",
  over: Partial<PlayerMatchStats> = {},
): PlayerMatchStats {
  return {
    steamId,
    name,
    squad,
    roundsPlayed: 20,
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
    byBuy: zeroByBuy(),
    byEnemyBuy: zeroByBuy(),
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
    hits: zeroHits(),
    hitDamage: zeroHits(),
    hitsBySide: { CT: zeroHits(), T: zeroHits() },
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
    bySide: {
      CT: { rounds: 10, kills: 0, deaths: 0, damage: 0 },
      T: { rounds: 10, kills: 0, deaths: 0, damage: 0 },
    },
    weapons: {},
    ...over,
  };
}

function round(
  number: number,
  winnerSquad: "A" | "B",
  winnerSide: Side,
  over: Partial<RoundRecord> = {},
): RoundRecord {
  return {
    number,
    winnerSquad,
    winnerSide,
    reason: "ct_elimination",
    bombPlanted: false,
    openingSquad: null,
    multiKill: { A: false, B: false },
    buy: { A: 4000, B: 4000 },
    buyType: { A: "full" as BuyType, B: "full" as BuyType },
    snipers: { A: 0, B: 0 },
    score: { A: 0, B: 0 },
    ...over,
  };
}

function match(over: Partial<MatchRecord> & { id: string }): MatchRecord {
  return {
    version: 9,
    playedAt: "2026-01-01T20:00:00.000Z",
    playedAtKnown: true,
    uploadedAt: "2026-01-02T10:00:00.000Z",
    uploadedBy: "teste",
    fileName: "demo.dem",
    fileSizeBytes: 1,
    map: "de_mirage",
    serverName: "servidor",
    demoType: "valve",
    tickRate: 64,
    durationSeconds: 2400,
    totalRounds: 20,
    score: { A: 13, B: 7 },
    startingSide: { A: "CT", B: "T" },
    clanName: { A: "", B: "" },
    teamLabel: { A: "Nosso time", B: "Adversário" },
    players: [],
    rounds: [],
    ...over,
  };
}

const config: AppConfig = {
  trackedSteamIds: ["1", "2"],
  teamName: "Nosso time",
  hiddenSteamIds: [],
  aliases: {},
  displayNames: {},
};

function dataset(matches: MatchRecord[]): Dataset {
  const tracked = new Set(config.trackedSteamIds);
  return {
    matches,
    views: matches.map((m) => viewMatch(m, tracked)),
    tracked,
    config,
    profiles: {},
  };
}

type Export = NonNullable<ReturnType<typeof buildPlayerExport>>;
type ExportMatch = Export["matches"][number];

const first = match({
  id: "m1",
  playedAt: "2026-01-01T20:00:00.000Z",
  map: "de_mirage",
  score: { A: 13, B: 7 },
  totalRounds: 20,
  players: [
    player("1", "hal", "A", { kills: 25, deaths: 10, damage: 1800, kastRounds: 15 }),
    player("2", "Luca", "A", { kills: 15, deaths: 14, damage: 1400, kastRounds: 13 }),
    player("9", "Rival", "B", { kills: 22, deaths: 18, damage: 1700, kastRounds: 12 }),
    player("8", "Rival2", "B", { kills: 9, deaths: 19, damage: 900, kastRounds: 8 }),
  ],
  rounds: [
    round(1, "A", "CT", {
      buyType: { A: "pistol", B: "pistol" },
      openingSquad: "A",
      score: { A: 1, B: 0 },
    }),
    round(2, "B", "T", {
      buyType: { A: "full", B: "eco" },
      openingSquad: "B",
      bombPlanted: true,
      reason: "bomb_exploded",
      score: { A: 1, B: 1 },
    }),
  ],
});

const second = match({
  id: "m2",
  playedAt: "2026-02-01T20:00:00.000Z",
  map: "de_mirage",
  score: { A: 8, B: 13 },
  totalRounds: 21,
  teamLabel: { A: "Nosso time", B: "Outros" },
  players: [
    player("1", "hal", "A", { roundsPlayed: 21, kills: 10, deaths: 20, damage: 1050, kastRounds: 9 }),
    player("2", "Luca", "A", { roundsPlayed: 21, kills: 24, deaths: 15, damage: 2000, kastRounds: 16 }),
    player("9", "Rival", "B", { roundsPlayed: 21, kills: 30, deaths: 12, damage: 2400, kastRounds: 18 }),
  ],
  rounds: [round(1, "B", "T", { buyType: { A: "eco", B: "full" }, score: { A: 0, B: 1 } })],
});

const data = dataset([second, first]);

{
  assert.equal(buildPlayerExport("404", data), null, "jogador inexistente vira null");
  console.log("ok   1. jogador inexistente");
}

{
  const out = buildPlayerExport("1", data) as Export;
  assert.equal(out.player.steamId, "1");
  assert.equal(out.player.name, "hal");
  assert.equal(out.player.matches, 2);
  assert.equal(out.player.rounds, 41, "rounds somam as duas partidas");
  assert.equal(out.player.firstMatch, first.playedAt, "primeira partida é a mais antiga");
  assert.equal(out.player.lastMatch, second.playedAt);
  assert.equal(out.career.kills, 35);
  assert.equal(out.career.deaths, 30);
  assert.equal(out.career.wins, 1);
  assert.equal(out.career.losses, 1);
  assert.deepEqual(
    (out.matches as ExportMatch[]).map((m) => m.matchId),
    ["m1", "m2"],
    "partidas em ordem cronológica",
  );
  console.log("ok   2. identidade, carreira e ordem das partidas");
}

{
  const out = buildPlayerExport("1", data) as Export;
  const [m1, m2] = out.matches as ExportMatch[];
  assert.equal(m1.result, "win");
  assert.equal(m1.ourScore, 13);
  assert.equal(m1.theirScore, 7);
  assert.equal(m1.opponent, "Adversário");
  assert.equal(m1.startingSide, "CT");
  assert.equal(m1.kd, 2.5);
  assert.equal(m1.adr, 90);
  assert.equal(m1.kast, 0.75);
  assert.equal(m2.result, "loss");
  assert.equal(m2.ourScore, 8);
  assert.equal(m2.theirScore, 13);
  assert.equal(m2.opponent, "Outros");
  console.log("ok   3. resultado, placar e taxas por partida");
}

{
  const out = buildPlayerExport("9", data) as Export;
  const [m1, m2] = out.matches as ExportMatch[];
  assert.equal(m1.result, "loss", "quem está do outro lado perdeu a primeira");
  assert.equal(m1.ourScore, 7, "placar é o do próprio jogador");
  assert.equal(m1.theirScore, 13);
  assert.equal(m1.opponent, "Nosso time", "o adversário dele somos nós");
  assert.equal(m1.startingSide, "T");
  assert.equal(m2.result, "win");
  assert.equal(m2.ourScore, 13);
  assert.equal(m2.theirScore, 8);
  assert.equal(
    m1.rounds[0].won,
    false,
    "round 1 foi do squad A, então o jogador do squad B perdeu",
  );
  assert.equal(m1.rounds[0].side, "T", "lado é o do jogador, não o nosso");
  assert.equal(m1.rounds[0].ourBuy, "pistol");
  assert.equal(m1.rounds[1].ourBuy, "eco", "a compra é a do time dele");
  assert.equal(m1.rounds[1].theirBuy, "full");
  assert.equal(m1.rounds[0].openedBy, "them", "a primeira kill foi do nosso squad");
  assert.equal(m1.rounds[1].openedBy, "us");
  console.log("ok   4. tudo pela perspectiva do jogador exportado");
}

{
  const out = buildPlayerExport("1", data) as Export;
  const [m1] = out.matches as ExportMatch[];
  assert.deepEqual(m1.rounds.map((r) => r.won), [true, false]);
  assert.deepEqual(m1.rounds.map((r) => r.side), ["CT", "CT"]);
  assert.deepEqual(m1.rounds.map((r) => r.openedBy), ["us", "them"]);
  assert.equal(m1.rounds[1].reason, "bomb_exploded");
  assert.equal(m1.rounds[1].bombPlanted, true);
  assert.deepEqual(m1.rounds[1].score, { A: 1, B: 1 });
  assert.equal(m1.rounds.length, first.rounds.length);
  console.log("ok   5. rounds em ordem, com lado, compra e placar");
}

{
  const out = buildPlayerExport("1", data) as Export;
  const [m1] = out.matches as ExportMatch[];
  assert.deepEqual(
    m1.teammates.map((t) => t.steamId),
    ["2"],
    "companheiros são os do mesmo squad, sem o próprio jogador",
  );
  assert.deepEqual(
    m1.opponents.map((t) => t.steamId).sort(),
    ["8", "9"],
    "adversários são os do outro squad",
  );
  assert.equal(m1.teammates[0].adr, 70);
  console.log("ok   6. companheiros e adversários da partida");
}

{
  const out = buildPlayerExport("1", data) as Export;
  const [m1] = out.matches as ExportMatch[];
  const keys = Object.keys(m1.stats);
  for (const heavy of ["heatmap", "placesVisited", "killsByPlace", "weaponUse", "byBuy"]) {
    assert.equal(keys.includes(heavy), false, `${heavy} fica de fora da partida`);
  }
  for (const kept of ["kills", "deaths", "kastRounds", "multiKills", "clutchesWon", "bySide"]) {
    assert.equal(keys.includes(kept), true, `${kept} continua na partida`);
  }
  assert.equal(m1.stats.kills, 25);
  console.log("ok   7. partida só com o que não é gigante");
}

{
  const out = buildPlayerExport("1", data) as Export;
  assert.equal(out.maps.length, 1);
  const [mirage] = out.maps;
  assert.equal(mirage.map, "de_mirage");
  assert.equal(mirage.matches, 2);
  assert.equal(mirage.wins, 1, "só a primeira partida foi vitória");
  assert.equal(mirage.rounds, 41);
  assert.equal(mirage.kills, 35);
  assert.equal(mirage.deaths, 30);
  assert.equal(mirage.adr, Math.round((2850 / 41) * 100) / 100);
  console.log("ok   8. recorte por mapa");
}

{
  const out = buildPlayerExport("1", data) as Export;
  const ids = out.teamBaseline.teammates.map((t) => t.steamId).sort();
  assert.deepEqual(ids, ["1", "2"], "a base de comparação é só o time acompanhado");
  const self = out.teamBaseline.teammates.find((t) => t.self);
  assert.equal(self?.steamId, "1");
  assert.equal(out.teamBaseline.rounds, 82);
  assert.equal(out.teamBaseline.players, 2);
  const kpr = out.teamBaseline.average.kpr;
  assert.equal(kpr, Math.round((74 / 82) * 100) / 100, "média do grupo é ponderada por rounds");
  console.log("ok   9. base de comparação do time");
}

{
  const duels = dataset([
    match({
      id: "m3",
      players: [
        player("1", "hal", "A", { duelMs: 6000, duelKills: 10, reactionMs: 4000, reactionKills: 8 }),
        player("2", "Luca", "A", { duelMs: 0, duelKills: 0, reactionMs: 0, reactionKills: 0 }),
        player("9", "Rival", "B"),
      ],
    }),
  ]);
  const out = buildPlayerExport("1", duels) as Export;
  assert.equal(out.career.ttkMs, 600);
  assert.equal(
    out.teamBaseline.average.ttkMs,
    600,
    "quem não teve duelo não puxa a média para baixo",
  );
  assert.equal(out.teamBaseline.average.reactionTimeMs, 500);
  console.log("ok  10. médias de tempo saem dos totais, não da média das médias");
}

{
  const out = buildPlayerExport("1", data) as Export;
  assert.equal(out.meta.source, "cs2stats");
  assert.equal(out.meta.team, "Nosso time");
  assert.ok(out.readme.length > 0, "readme explica o arquivo");
  assert.ok(Object.keys(out.glossary).length > 20, "glossário cobre os campos");
  for (const key of ["rating", "kast", "byEnemyBuy", "topFragMatches"]) {
    assert.ok(out.glossary[key], `glossário explica ${key}`);
  }
  assert.ok(Array.isArray(out.teamInsights));
  const body = JSON.stringify(out);
  assert.equal(body.includes('"heatmap"'), false, "nenhum heatmap no arquivo");
  console.log("ok  11. readme, glossário e tamanho sob controle");
}

{
  const tie = dataset([
    match({
      id: "m4",
      score: { A: 12, B: 12 },
      players: [
        player("1", "hal", "A", { kills: 20, deaths: 0, damage: 2400, roundsPlayed: 24 }),
        player("9", "Rival", "B"),
      ],
    }),
  ]);
  const out = buildPlayerExport("1", tie) as Export;
  const [only] = out.matches as ExportMatch[];
  assert.equal(only.result, "tie");
  assert.equal(only.kd, 20, "sem mortes, o K/D é o número de kills");
  assert.equal(out.maps[0].wins, 0, "empate não conta como vitória");
  console.log("ok  12. empate e divisão por zero");
}

console.log("\ntodos os testes do export passaram");
