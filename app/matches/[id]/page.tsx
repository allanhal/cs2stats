import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Card,
  Hero,
  MapIcon,
  Pill,
  PlayerTag,
  SectionTitle,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { RouteHeatmap, RouteHeatmapControls, RouteHeatmapGroup } from "@/components/route-heatmap";
import { radarFor } from "@/lib/radar";
import { resolveTracked, viewMatch } from "@/lib/aggregate";
import { applyIdentity, makeIdentity } from "@/lib/identity";
import { getConfig, getMatch, getProfiles, heatmapForMatch, listMatches } from "@/lib/store";
import {
  BUY_LABELS,
  REASON_LABELS,
  duration,
  mapLabel,
  num,
  pct,
} from "@/lib/format";
import type { Profiles } from "@/lib/profiles";
import type { PlayerMatchStats } from "@/lib/types";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const stored = await getMatch(id);
  if (!stored) notFound();

  const config = await getConfig();
  const all = await listMatches();
  const profiles = await getProfiles();
  const identity = makeIdentity(config);
  const match = applyIdentity(stored, identity);
  const tracked = resolveTracked(
    all.map((m) => applyIdentity(m, identity)),
    { ...config, trackedSteamIds: config.trackedSteamIds.map(identity.canonical) },
  );
  const v = viewMatch(match, tracked);

  const sideOfSquad = (squad: "A" | "B", round: (typeof match.rounds)[number]) =>
    round.winnerSquad === squad ? round.winnerSide : round.winnerSide === "CT" ? "T" : "CT";

  const ourSquad = v.ourSquad ?? "A";
  const theirSquad = ourSquad === "A" ? "B" : "A";

  const ourSteamIds = v.ourPlayers.map((p) => p.steamId);
  const cells = await heatmapForMatch(match.id, ourSteamIds);
  const radar = radarFor(match.map);
  const heatPoints: Record<"CT" | "T", { x: number; y: number; seconds: number; kills: number; deaths: number }[]> = {
    CT: [],
    T: [],
  };
  if (radar) {
    const keys = new Set([
      ...Object.keys(cells.presence),
      ...Object.keys(cells.kills),
      ...Object.keys(cells.deaths),
    ]);
    for (const key of keys) {
      const [, side, rawX, rawY] = key.split("|", 4);
      const x = Number(rawX);
      const y = Number(rawY);
      if ((side !== "CT" && side !== "T") || !Number.isFinite(x) || !Number.isFinite(y)) continue;
      const point = {
        x: ((x - radar.posX) / (radar.scale * 1024)) * 100,
        y: ((radar.posY - y) / (radar.scale * 1024)) * 100,
        seconds: cells.presence[key] ?? 0,
        kills: cells.kills[key] ?? 0,
        deaths: cells.deaths[key] ?? 0,
      };
      if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) continue;
      heatPoints[side].push(point);
    }
  }
  const roundsBySide = { CT: 0, T: 0 };
  for (const round of match.rounds) {
    const side = sideOfSquad(ourSquad, round);
    roundsBySide[side] += 1;
  }
  const hasHeat = heatPoints.CT.length + heatPoints.T.length > 0;

  return (
    <div className="relative space-y-7">
      <Hero maps={[match.map]}>
        <div className="flex min-h-[150px] flex-col justify-between gap-6 sm:min-h-[180px]">
          <Link href="/matches" className="text-xs text-fog-300 hover:text-fog-100">
            ← todas as partidas
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
            <div className="flex items-center gap-4">
              <MapIcon map={match.map} className="size-14 drop-shadow-lg sm:size-16" />
              <div className="min-w-0">
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
                  {mapLabel(match.map)}
                </h1>
                <p className="mt-1.5 text-sm text-fog-300">
                  {v.opponent ? <>contra {v.opponent} · </> : null}
                  {match.totalRounds} rounds · {duration(match.durationSeconds)} ·{" "}
                  {match.playedAtKnown ? (
                    <LocalTime iso={match.playedAt} />
                  ) : (
                    <>enviada <LocalTime iso={match.uploadedAt} /></>
                  )}{" "}
                  · por {match.uploadedBy}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 sm:flex-col sm:items-end sm:gap-1.5">
              <div className="tnum text-4xl font-bold leading-none tracking-tight sm:text-5xl">
                <span className={v.result === "win" ? "text-win" : "text-loss"}>{v.ourScore}</span>
                <span className="px-1.5 text-fog-500">–</span>
                <span className="text-fog-300">{v.theirScore}</span>
              </div>
              <Pill tone={v.result === "win" ? "win" : v.result === "loss" ? "loss" : "neutral"}>
                {v.result === "win" ? "Vitória" : v.result === "loss" ? "Derrota" : "Empate"}
              </Pill>
            </div>
          </div>
        </div>
      </Hero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          tone="ct"
          label="Rounds como CT"
          value={(() => {
            const rounds = match.rounds.filter((r) => sideOfSquad(ourSquad, r) === "CT");
            const won = rounds.filter((r) => r.winnerSquad === ourSquad).length;
            return `${won}/${rounds.length}`;
          })()}
        />
        <Stat
          tone="tr"
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

      {hasHeat && radar ? (
        <RouteHeatmapGroup defaultMetric="balance">
          <Card>
            <SectionTitle
              title="Saldo por posição"
              hint="Kills menos mortes do nosso time em cada pedaço do mapa, pelas posições amostradas a cada segundo"
              action={<RouteHeatmapControls />}
            />
            <div className="grid gap-5 lg:grid-cols-2">
              {(["CT", "T"] as const).map((side) => (
                <div key={side}>
                  <Pill tone={side === "CT" ? "ct" : "tr"}>{side}</Pill>
                  <RouteHeatmap
                    id={`${match.id}-${side}`}
                    side={side}
                    radar={radar}
                    points={heatPoints[side]}
                    rounds={roundsBySide[side]}
                    controls={false}
                  />
                </div>
              ))}
            </div>
          </Card>
        </RouteHeatmapGroup>
      ) : null}

      <Scoreboard
        title={match.teamLabel[ourSquad] || config.teamName}
        players={v.ourPlayers.length > 0 ? v.ourPlayers : match.players.filter((p) => p.squad === "A")}
        profiles={profiles}
        highlight
      />
      <Scoreboard
        title={match.teamLabel[theirSquad] || "Adversários"}
        players={v.ourPlayers.length > 0 ? v.theirPlayers : match.players.filter((p) => p.squad === "B")}
        profiles={profiles}
      />
    </div>
  );
}

function Scoreboard({
  title,
  players,
  profiles,
  highlight = false,
}: {
  title: string;
  players: PlayerMatchStats[];
  profiles: Profiles;
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
                  <PlayerTag name={p.name} avatar={profiles[p.steamId]?.avatar} />
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
