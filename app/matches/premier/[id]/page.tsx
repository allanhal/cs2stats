import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/local-time";
import { Card, Pill, SectionTitle, Table, Td, Th } from "@/components/ui";
import { premierClock, premierOwner, premierResult } from "@/lib/premier";
import { listMatches, listPremierScoreboards } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function PremierScoreboardPage({ params }: PageProps<"/matches/premier/[id]">) {
  const { id } = await params;
  const board = (await listPremierScoreboards()).find((entry) => entry.id === id);
  if (!board) notFound();

  const result = premierResult(board);
  const demo = board.replayFileName
    ? (await listMatches()).find((match) => match.fileName === board.replayFileName)
    : undefined;

  return (
    <div className="space-y-4">
      <Link href="/matches/premier" className="text-sm text-fog-500 hover:text-fog-100">
        ← Histórico Premier
      </Link>
      <div>
        <div className="flex flex-wrap items-baseline gap-3">
          <h1 className="text-2xl font-semibold">{board.map}</h1>
          <span className="tnum text-xl">{result.score}–{result.opponent}</span>
          <Pill tone={result.tone}>{result.label}</Pill>
        </div>
        <p className="mt-1 text-sm text-fog-500">
          Premier · {board.ranked ? "Com ranking" : "Sem ranking"} · <LocalTime iso={board.playedAt} />
          {" · "}{premierClock(board.durationSeconds)} de partida · {premierClock(board.waitSeconds)} de fila
        </p>
        {demo ? (
          <Link href={`/matches/${demo.id}`} className="mt-1 inline-block text-sm hover:text-win">
            Ver análise da demo →
          </Link>
        ) : null}
      </div>
      {[board.ownerTeam, 1 - board.ownerTeam].map((team) => (
        <Card key={team}>
          <SectionTitle title={team === board.ownerTeam ? `Time de ${premierOwner(board)}` : "Adversários"} />
          <Table>
            <thead>
              <tr>
                <Th align="left">Jogador</Th>
                <Th>Ping</Th>
                <Th title="Kills">K</Th>
                <Th title="Assistências">A</Th>
                <Th title="Mortes">D</Th>
                <Th>MVPs</Th>
                <Th title="Porcentagem de kills na cabeça">HS%</Th>
                <Th>Pontos</Th>
              </tr>
            </thead>
            <tbody>
              {board.teams[team].players.map((player) => (
                <tr key={player.steamId}>
                  <Td align="left">{player.name}</Td>
                  <Td>{player.ping ?? "—"}</Td>
                  <Td>{player.kills ?? "—"}</Td>
                  <Td>{player.assists ?? "—"}</Td>
                  <Td>{player.deaths ?? "—"}</Td>
                  <Td>{player.mvps ?? "—"}</Td>
                  <Td>{player.headshotPercent === null ? "—" : `${player.headshotPercent}%`}</Td>
                  <Td>{player.score ?? "—"}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </Card>
      ))}
    </div>
  );
}
