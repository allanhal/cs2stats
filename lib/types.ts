export type Side = "CT" | "T";

export interface PlayerMatchStats {
  steamId: string;
  name: string;
  squad: "A" | "B";

  roundsPlayed: number;
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
  byBuy: Record<BuyType, BuyStats>;
  sniperRounds: Record<BuyType, number>;
  sniperRoundsWon: Record<BuyType, number>;
  sniperKills: number;
  sniperDeaths: number;

  tradeKills: number;
  tradedDeaths: number;

  multiKills: { k1: number; k2: number; k3: number; k4: number; k5: number };
  clutchesWon: { v1: number; v2: number; v3: number; v4: number; v5: number };
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

  killsByPlace: Record<string, number>;
  deathsByPlace: Record<string, number>;
  placesVisited: Record<string, number>;
  heatmap: Record<string, number>;

  bySide: Record<Side, { rounds: number; kills: number; deaths: number; damage: number }>;

  weapons: Record<string, number>;
}

export interface RoundRecord {
  number: number;
  winnerSquad: "A" | "B";
  winnerSide: Side;
  reason: string;
  bombPlanted: boolean;

  buy: { A: number; B: number };
  buyType: { A: BuyType; B: BuyType };
  snipers: { A: number; B: number };

  score: { A: number; B: number };
}

export type BuyType = "pistol" | "eco" | "force" | "semi" | "full";

export type BuyStats = {
  rounds: number;
  won: number;
  kills: number;
  deaths: number;
  damage: number;
};

export interface MatchRecord {
  id: string;

  version: number;

  playedAt: string;

  playedAtKnown: boolean;
  uploadedAt: string;
  uploadedBy: string;
  fileName: string;
  fileSizeBytes: number;

  map: string;
  serverName: string;
  demoType: string;
  tickRate: number;
  durationSeconds: number;

  totalRounds: number;
  score: { A: number; B: number };

  startingSide: { A: Side; B: Side };
  clanName: { A: string; B: string };

  teamLabel: { A: string; B: string };

  players: PlayerMatchStats[];
  rounds: RoundRecord[];
}

export interface AppConfig {
  trackedSteamIds: string[];
  teamName: string;

  hiddenSteamIds: string[];

  aliases: Record<string, string>;

  displayNames: Record<string, string>;
}
