export interface PremierPlayer {
  steamId: string;
  name: string;
  ping: number | null;
  kills: number | null;
  assists: number | null;
  deaths: number | null;
  mvps: number | null;
  headshotPercent: number | null;
  score: number | null;
}

export interface PremierScoreboard {
  id: string;
  playedAt: string;
  map: string;
  durationSeconds: number;
  waitSeconds: number;
  ranked: boolean;
  replayFileName?: string;
  ownerSteamId: string;
  ownerTeam: 0 | 1;
  teams: [
    { score: number; players: PremierPlayer[] },
    { score: number; players: PremierPlayer[] },
  ];
}

export function premierOwner(board: PremierScoreboard): string {
  return board.teams[board.ownerTeam].players.find((player) => player.steamId === board.ownerSteamId)
    ?.name ?? "Jogador";
}

export function premierClock(seconds: number): string {
  const remainder = String(seconds % 60).padStart(2, "0");
  return `${Math.floor(seconds / 60)}:${remainder}`;
}

export function premierResult(board: PremierScoreboard) {
  const score = board.teams[board.ownerTeam].score;
  const opponent = board.teams[1 - board.ownerTeam].score;
  return {
    score,
    opponent,
    tone:
      score > opponent ? ("win" as const) : score < opponent ? ("loss" as const) : ("neutral" as const),
    label: score > opponent ? "Vitória" : score < opponent ? "Derrota" : "Empate",
  };
}

function resultTotals() {
  return { matches: 0, wins: 0, losses: 0, ties: 0, roundsWon: 0, roundsLost: 0 };
}

export function summarizePremier(boards: PremierScoreboard[]) {
  const overall = resultTotals();
  const maps = new Map<string, ReturnType<typeof resultTotals>>();
  const player = { kills: 0, assists: 0, deaths: 0, mvps: 0, scoreboards: 0 };

  for (const board of boards) {
    const { score, opponent } = premierResult(board);
    const outcome = score > opponent ? "wins" : score < opponent ? "losses" : "ties";
    const map = maps.get(board.map) ?? resultTotals();
    maps.set(board.map, map);

    for (const totals of [overall, map]) {
      totals.matches++;
      totals[outcome]++;
      totals.roundsWon += score;
      totals.roundsLost += opponent;
    }

    const owner = board.teams[board.ownerTeam].players.find(
      ({ steamId }) => steamId === board.ownerSteamId,
    );
    if (owner?.kills != null && owner.assists != null && owner.deaths != null) {
      player.scoreboards++;
      player.kills += owner.kills;
      player.assists += owner.assists;
      player.deaths += owner.deaths;
    }
    player.mvps += owner?.mvps ?? 0;
  }

  return {
    overall,
    player,
    maps: [...maps].sort(
      ([a, first], [b, second]) => second.matches - first.matches || a.localeCompare(b),
    ),
  };
}
