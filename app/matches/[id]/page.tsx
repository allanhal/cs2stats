import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Pill, SectionTitle, Stat, Table, Td, Th } from "@/components/ui";
import { callouts, resolveTracked, viewMatch } from "@/lib/aggregate";
import { applyIdentity, makeIdentity } from "@/lib/identity";
import { getConfig, getMatch, listMatches } from "@/lib/store";
import {
  BUY_LABELS,
  REASON_LABELS,
  dateTimeLabel,
  duration,
  mapLabel,
  num,
  pct,
} from "@/lib/format";
import type { PlayerMatchStats } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getMatch(id);
  if (!stored) notFound();

  const config = await getConfig();
  const all = await listMatches();
  const identity = makeIdentity(config);
  const match = applyIdentity(stored, identity);
  const tracked = resolveTracked(
    all.map((m) => applyIdentity(m, identity)),
    { ...config, trackedSteamIds: config.trackedSteamIds.map(identity.canonical) },
  );
  const v = viewMatch(match, tracked);
  const places = callouts([v]);

  const sideOfSquad = (squad: "A" | "B", round: (typeof match.rounds)[number]) =>
    round.winnerSquad === squad ? round.winnerSide : round.winnerSide === "CT" ? "T" : "CT";

  const ourSquad = v.ourSquad ?? "A";
  const theirSquad = ourSquad === "A" ? "B" : "A";

  return (
    <div className="space-y-7">
      <div>
        <Link href="/matches" className="text-xs text-fog-500 hover:text-fog-100">
          ← todas as partidas
        </Link>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">{mapLabel(match.map)}</h1>
          <span className="tnum text-2xl font-semibold">
            <span className={v.result === "win" ? "text-win" : "text-loss"}>{v.ourScore}</span>
            <span className="text-fog-500"> – {v.theirScore}</span>
          </span>
          <Pill tone={v.result === "win" ? "win" : v.result === "loss" ? "loss" : "neutral"}>
            {v.result === "win" ? "Vitória" : v.result === "loss" ? "Derrota" : "Empate"}
          </Pill>
        </div>
        <p className="mt-1.5 text-sm text-fog-500">
          {v.opponent ? <>contra {v.opponent} · </> : null}
          {match.totalRounds} rounds · {duration(match.durationSeconds)} ·{" "}
          {match.playedAtKnown ? dateTimeLabel(match.playedAt) : `enviada ${dateTimeLabel(match.uploadedAt)}`}{" "}
          · por {match.uploadedBy}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          label="Rounds como CT"
          value={(() => {
            const rounds = match.rounds.filter((r) => sideOfSquad(ourSquad, r) === "CT");
            const won = rounds.filter((r) => r.winnerSquad === ourSquad).length;
            return `${won}/${rounds.length}`;
          })()}
        />
        <Stat
          label="Rounds como TR"
          value={(() => {
            const rounds = match.rounds.filter((r) => sideOfSquad(ourSquad, r) === "T");
            const won = rounds.filter((r) => r.winnerSquad === ourSquad).length;
            return `${won}/${rounds.length}`;
          })()}
        />
        <Stat
          label="Bombas plantadas"
          value={v.ourPlayers.reduce((a, p) => a + p.bombsPlanted, 0)}
          sub={`${v.ourPlayers.reduce((a, p) => a + p.bombsDefused, 0)} desarmadas`}
        />
        <Stat
          label="Pistolas"
          value={(() => {
            const rounds = match.rounds.filter((r) => r.buyType[ourSquad] === "pistol");
            const won = rounds.filter((r) => r.winnerSquad === ourSquad).length;
            return `${won}/${rounds.length}`;
          })()}
        />
      </div>

      <Card>
        <SectionTitle title="Linha do tempo" hint="Cada bloco é um round; a cor indica quem ganhou" />
        <div className="flex flex-wrap gap-1">
          {match.rounds.map((r) => {
            const won = r.winnerSquad === ourSquad;
            const ourSide = sideOfSquad(ourSquad, r);
            return (
              <div
                key={r.number}
                title={`Round ${r.number} — ${won ? "ganhamos" : "perdemos"} (${
                  REASON_LABELS[r.reason] ?? r.reason
                }) jogando ${ourSide === "CT" ? "CT" : "TR"} · ${BUY_LABELS[r.buyType[ourSquad]]}`}
                className={`grid h-9 w-7 place-items-center rounded text-[10px] font-semibold tnum ${
                  won ? "bg-win/20 text-win" : "bg-loss/20 text-loss"
                }`}
              >
                <span>{r.number}</span>
                <span className={ourSide === "CT" ? "text-ct" : "text-tr"}>
                  {ourSide === "CT" ? "CT" : "TR"}
                </span>
              </div>
            );
          })}
        </div>
      </Card>

      {places.length > 0 ? (
        <Card>
          <SectionTitle title="Callouts" hint="Onde cada duelo nosso foi ganho ou perdido" />
          <div className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {places.slice(0, 15).map((place) => {
              const total = place.kills + place.deaths;
              return (
                <div key={place.place}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{place.place}</span>
                    <span className="tnum text-xs">
                      <span className="text-win">{place.kills}</span>
                      <span className="text-fog-500">/</span>
                      <span className="text-loss">{place.deaths}</span>
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="bg-win" style={{ width: `${(place.kills / total) * 100}%` }} />
                    <div className="bg-loss" style={{ width: `${(place.deaths / total) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ) : null}

      <Scoreboard
        title={match.teamLabel[ourSquad] || config.teamName}
        players={v.ourPlayers.length > 0 ? v.ourPlayers : match.players.filter((p) => p.squad === "A")}
        highlight
      />
      <Scoreboard
        title={match.teamLabel[theirSquad] || "Adversários"}
        players={v.ourPlayers.length > 0 ? v.theirPlayers : match.players.filter((p) => p.squad === "B")}
      />
    </div>
  );
}

function Scoreboard({
  title,
  players,
  highlight = false,
}: {
  title: string;
  players: PlayerMatchStats[];
  highlight?: boolean;
}) {
  const sorted = [...players].sort((a, b) => b.kills - a.kills || a.deaths - b.deaths);
  return (
    <Card className={highlight ? "border-win/25" : ""}>
      <SectionTitle title={title} />
      <Table>
        <thead>
          <tr>
            <Th align="left">Jogador</Th>
            <Th>K</Th>
            <Th>D</Th>
            <Th>A</Th>
            <Th title="Assists de flash">FA</Th>
            <Th>ADR</Th>
            <Th>KAST</Th>
            <Th>HS%</Th>
            <Th title="Entry kills / entry deaths">Entry</Th>
            <Th title="2k / 3k / 4k / 5k">Multi</Th>
            <Th title="Clutches ganhos / jogados">Clutch</Th>
            <Th title="Dano de utilitário">Util</Th>
            <Th>MVP</Th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => (
            <tr key={p.steamId}>
              <Td align="left" className="font-medium">
                <Link href={`/players/${p.steamId}`} className="hover:text-win">
                  {p.name}
                </Link>
              </Td>
              <Td>{p.kills}</Td>
              <Td>{p.deaths}</Td>
              <Td>{p.assists}</Td>
              <Td className="text-fog-500">{p.flashAssists}</Td>
              <Td>{(p.damage / Math.max(p.roundsPlayed, 1)).toFixed(0)}</Td>
              <Td>{pct(p.kastRounds / Math.max(p.roundsPlayed, 1))}</Td>
              <Td>{pct(p.kills ? p.headshotKills / p.kills : 0)}</Td>
              <Td className="text-fog-500">
                {p.openingKills}/{p.openingDeaths}
              </Td>
              <Td className="text-fog-500">
                {p.multiKills.k2}/{p.multiKills.k3}/{p.multiKills.k4}/{p.multiKills.k5}
              </Td>
              <Td className="text-fog-500">
                {Object.values(p.clutchesWon).reduce((a, b) => a + b, 0)}/{p.clutchesPlayed}
              </Td>
              <Td className="text-fog-500">{p.utilityDamage}</Td>
              <Td className="text-fog-500">{p.mvps}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
      <p className="mt-3 text-[11px] text-fog-500">
        {sorted.length} jogadores · ADR e KAST calculados sobre os rounds que cada um jogou
        {sorted.some((p) => p.roundsPlayed !== sorted[0]?.roundsPlayed)
          ? " (alguns entraram no meio da partida)"
          : ""}
        . Rating médio do time:{" "}
        {num(
          sorted.reduce((a, p) => a + p.kills / Math.max(p.roundsPlayed, 1), 0) /
            Math.max(sorted.length, 1),
          2,
        )}{" "}
        kills por round.
      </p>
    </Card>
  );
}
