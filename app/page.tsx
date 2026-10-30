import Link from "next/link";
import {
  Card,
  Empty,
  Hero,
  MapIcon,
  MapTag,
  Meter,
  Pill,
  PlayerTag,
  ProgressBar,
  SectionTitle,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { PlayerRanks, type RankRow } from "@/components/player-ranks";
import { FifaCard } from "@/components/fifa-card";
import {
  aggregatePlayers,
  bestLines,
  worstLines,
  worstPlayers,
  lobbyImpact,
  byMap,
  lineups,
  roundBreakdown,
  totals,
  viewsIn,
  type Lineup,
  type LineChemistry,
} from "@/lib/aggregate";
import { CartinhaDestaque } from "@/components/cartinha-destaque";
import { buildCard } from "@/lib/card";
import { HERO_TONES, buildHeroCard } from "@/lib/bosta";
import { loadDataset } from "@/lib/data";
import { insights } from "@/lib/insights";
import type { Profiles } from "@/lib/profiles";
import { BUY_LABELS, mapLabel, pct } from "@/lib/format";
import { LocalTime } from "@/components/local-time";
import { MapBlendBackdrop } from "@/components/map-blend-backdrop";
import { MapWinrateChart, type MapWinrateRow } from "@/components/map-winrate-chart";
import { MapWinrateRadar } from "@/components/map-winrate-radar";
import { MapWinrateTabs } from "@/components/map-winrate-tabs";

export const dynamic = "force-dynamic";

const MIN_MATCHES = 10;

export default async function Dashboard() {
  const { views, tracked, config, profiles } = await loadDataset();
  const leituras = insights(views);

  if (views.length === 0) {
    return (
      <Empty
        title="Nenhuma demo enviada ainda"
        body="Envie o primeiro arquivo .dem e a página passa a mostrar vitórias, derrotas, mapas, presença e o desempenho de cada jogador."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const t = totals(views);
  const maps = byMap(views);
  const players = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const ranked = players.filter((p) => p.matches >= MIN_MATCHES);
  const podium = ["mvp", "ouro", "prata"] as const;
  const badges = ["MVP", "2º", "3º"];
  const topCards = (ranked.length >= 3 ? ranked : players).slice(0, 3).map((p, index) =>
    buildCard(p, views, {
      club: config.teamName,
      avatar: profiles[p.steamId]?.avatar,
      edition: podium[index],
      badge: badges[index],
    }),
  );

  const highlights = topCards.map((card, index) => ({
    card,
    caption: index === 0 ? "MVP do grupo" : `${index + 1}º no rating`,
  }));
  const rankRows: RankRow[] = players.map((p) => ({
    steamId: p.steamId,
    name: p.name,
    avatar: profiles[p.steamId]?.avatar,
    matches: p.matches,
    rating: p.rating,
    kills: p.kills,
    deaths: p.deaths,
    assists: p.assists,
    kd: p.kd,
    adr: p.adr,
    kast: p.kast,
    hsPercent: p.hsPercent,
    openingKills: p.openingKills,
    openingDeaths: p.openingDeaths,
    clutchesWon: Object.values(p.clutchesWon).reduce((a, b) => a + b, 0),
    clutchesPlayed: p.clutchesPlayed,
  }));
  const breakdown = roundBreakdown(views);
  const recent = views.slice(0, 6);
  const form = views.slice(0, 10).reverse();
  const latestMaps: string[] = [];
  for (const v of views) {
    if (latestMaps.length >= 3) break;
    if (!latestMaps.includes(v.match.map)) latestMaps.push(v.match.map);
  }
  const linesFor = (min: number) =>
    bestLines(views, new Set(players.filter((p) => p.matches >= min).map((p) => p.steamId)), {
      top: 3,
    });
  const lineGroups = [
    { min: 3, lines: linesFor(3) },
    { min: 10, lines: linesFor(10) },
  ].filter((g) => g.lines.length > 0);
  const worstLinesFor = (min: number) =>
    worstLines(views, new Set(players.filter((p) => p.matches >= min).map((p) => p.steamId)), {
      top: 3,
    });
  const lobby = lobbyImpact(views, tracked, { minPlayed: 5, minAbsent: 5 });
  const worstIn = (steamIds: string[]) =>
    worstPlayers(players, lobby, { only: new Set(steamIds) })[0]?.steamId ?? null;
  const worstLineGroups = [
    { min: 3, lines: worstLinesFor(3) },
    { min: 10, lines: worstLinesFor(10) },
  ].filter((g) => g.lines.length > 0);
  const weekViews = viewsIn(views, "semana");
  const weekLine =
    lineups(weekViews, tracked, { size: "five", minPlayed: 1 })[0] ??
    lineups(weekViews, tracked, { size: "full", minPlayed: 1 })[0] ??
    null;
  const heroes = HERO_TONES.map((tone) => ({
    tone,
    card: buildHeroCard(views, tracked, {
      club: config.teamName,
      profiles,
      period: "semana",
      tone: tone.key,
    }),
  })).filter((h) => h.card !== null);
  const streakLabel =
    t.currentStreak.kind === "win"
      ? `${t.currentStreak.length} vitória${t.currentStreak.length > 1 ? "s" : ""} seguida${t.currentStreak.length > 1 ? "s" : ""}`
      : t.currentStreak.kind === "loss"
        ? `${t.currentStreak.length} derrota${t.currentStreak.length > 1 ? "s" : ""} seguida${t.currentStreak.length > 1 ? "s" : ""}`
        : "—";

  const MIN_MAP_MATCHES = 1;
  const mapRanking: MapWinrateRow[] = maps
    .filter((m) => m.played >= MIN_MAP_MATCHES)
    .map((m) => ({
      map: m.map,
      played: m.played,
      wins: m.wins,
      losses: m.losses,
      ties: m.ties,
      winRate: m.winRate,
      ctRate: m.bySide.CT.played ? m.bySide.CT.won / m.bySide.CT.played : 0,
      trRate: m.bySide.T.played ? m.bySide.T.won / m.bySide.T.played : 0,
      rounds: m.roundsWon + m.roundsLost,
    }))
    .sort((a, b) => b.winRate - a.winRate || b.played - a.played);

  const topMap = maps.reduce(
    (best, m) => (best === null || m.played > best.played ? m : best),
    null as (typeof maps)[number] | null,
  );

  return (
    <div className="relative space-y-8">
      <Hero maps={latestMaps}>
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                {config.teamName}
              </h1>
              <Pill tone={t.winRate >= 0.5 ? "win" : "loss"}>{pct(t.winRate)} de vitórias</Pill>
            </div>
            <p className="mt-1.5 text-sm text-fog-300">
              {t.matches} partida{t.matches === 1 ? "" : "s"} analisada
              {t.matches === 1 ? "" : "s"} · {maps.length} mapa{maps.length === 1 ? "" : "s"} ·{" "}
              {players.length} jogador{players.length === 1 ? "" : "es"} no grupo
            </p>
          </div>
          {form.length > 0 ? (
            <div className="flex flex-col gap-1.5 sm:items-end">
              <span className="text-[11px] font-medium uppercase tracking-wider text-fog-500">
                Últimas {form.length} partidas
              </span>
              <div className="flex flex-wrap gap-1.5">
                {form.map((v) => (
                  <Link
                    key={v.match.id}
                    href={`/matches/${v.match.id}`}
                    title={`${mapLabel(v.match.map)} ${v.ourScore}–${v.theirScore}`}
                    className={`grid size-9 place-items-center rounded-lg border transition-colors ${
                      v.result === "win"
                        ? "border-win/50 bg-win/15 hover:bg-win/25"
                        : v.result === "loss"
                          ? "border-loss/50 bg-loss/15 hover:bg-loss/25"
                          : "border-ink-700 bg-ink-800/60 hover:bg-ink-800"
                    }`}
                  >
                    <MapIcon map={v.match.map} className="size-6" />
                  </Link>
                ))}
              </div>
              <span className="text-xs text-fog-300">
                {t.currentStreak.length > 0 ? streakLabel : "sem sequência"}
              </span>
            </div>
          ) : null}
        </div>
      </Hero>


      {mapRanking.length > 1 ? (
        <Card className="relative overflow-hidden">
          <MapBlendBackdrop maps={mapRanking.slice(0, 3).map((m) => m.map)} />
          <div className="relative">
            <MapWinrateTabs
              radar={<MapWinrateRadar rows={mapRanking} />}
              ranking={<MapWinrateChart rows={mapRanking} />}
            />
          </div>
        </Card>
      ) : null}

      <Card>
        <SectionTitle
          title="Mapas"
          hint="Aproveitamento por mapa e por lado"
          action={
            <Link href="/matches" className="text-xs text-fog-500 hover:text-fog-100">
              ver partidas →
            </Link>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Mapa</Th>
              <Th>Jogos</Th>
              <Th title="Vitórias, derrotas e empates">V–D–E</Th>
              <Th>Win rate</Th>
              <Th>Rounds</Th>
              <Th title="Rounds ganhos como CT">CT</Th>
              <Th title="Rounds ganhos como TR">TR</Th>
              <Th align="left">&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {maps.map((m) => (
              <tr key={m.map}>
                <Td align="left" className="font-medium">
                  <MapTag map={m.map} />
                </Td>
                <Td>{m.played}</Td>
                <Td>
                  <span className="text-win">{m.wins}</span>
                  <span className="text-fog-500">–</span>
                  <span className="text-loss">{m.losses}</span>
                  <span className="text-fog-500">–{m.ties}</span>
                </Td>
                <Td className={m.winRate >= 0.5 ? "text-win" : "text-loss"}>{pct(m.winRate)}</Td>
                <Td className="text-fog-500">
                  {m.roundsWon}–{m.roundsLost}
                </Td>
                <Td className="text-ct">
                  {pct(m.bySide.CT.played ? m.bySide.CT.won / m.bySide.CT.played : 0)}
                </Td>
                <Td className="text-tr">
                  {pct(m.bySide.T.played ? m.bySide.T.won / m.bySide.T.played : 0)}
                </Td>
                <Td align="left" className="w-28">
                  <Meter value={m.winRate} />
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {highlights.length > 0 ? (
        <section className="space-y-4">
          <SectionTitle
            title="Top 3"
            hint="As cartinhas dos três melhores ratings, com o fundo do mapa em que cada um joga melhor"
          />
          <div className="flex flex-wrap justify-center gap-5">
            {highlights.map(({ card, caption }) => (
              <Link
                key={caption}
                href={`/players/${card.steamId}/cartinha`}
                className="flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"
              >
                <FifaCard card={card} scale={0.44} />
                <span className="text-xs text-fog-500">{caption}</span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <PlayerRanks rows={rankRows} minMatches={MIN_MATCHES} />


      {lineGroups.length > 0 || weekLine ? (
        <Card id="melhores-lines">
          <SectionTitle
            title="Melhores lines"
            hint="Os cinco que melhor se dão em quadra: média de aproveitamento das 10 duplas da line, entre os quintetos que já jogaram juntos. Dois cortes de experiência para o grupo não ficar refém de quem jogou pouco."
          />
          <div className="space-y-4">
            {lineGroups.map((group) => (
              <div key={group.min}>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fog-500">
                  Quem tem {group.min}+ partidas
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {group.lines.map((line, index) => (
                    <LineBlock
                      key={line.steamIds.join("|")}
                      title={`${index + 1}ª melhor line`}
                      line={line}
                      chemistry={line.chemistry}
                      profiles={profiles}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
          {weekLine ? (
            <div className="mt-2">
              <LineBlock title="Melhor line da semana" line={weekLine} profiles={profiles} />
            </div>
          ) : null}
        </Card>
      ) : null}

      {heroes.length > 0 ? (
        <Card>
          <SectionTitle
            title="Cartinhas da semana"
            hint="O melhor e o pior de segunda-feira para cá, pelo KAST, pelas kills por round e pelo efeito no aproveitamento do lobby."
            action={
              <Link href="/cartinhas" className="text-xs text-fog-500 hover:text-fog-100">
                ver todas →
              </Link>
            }
          />
          <div className="flex flex-wrap justify-center gap-6">
            {heroes.map(({ tone, card }) => (
              <Link
                key={tone.key}
                href={`/cartinhas/${tone.key}?periodo=semana`}
                className="flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"
              >
                <CartinhaDestaque card={card!} scale={0.42} />
                <span className="text-xs text-fog-500">
                  {tone.label.toLowerCase()} · {card!.name}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      ) : null}

      {worstLineGroups.length > 0 ? (
        <Card>
          <SectionTitle
            title="Piores lines"
            hint="O megazord ao contrário: os quintetos que menos funcionam juntos. Mesma conta das melhores lines e os mesmos dois cortes de experiência, só que de baixo para cima."
          />
          <div className="space-y-4">
            {worstLineGroups.map((group) => (
              <div key={group.min}>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-fog-500">
                  Quem tem {group.min}+ partidas
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {group.lines.map((line, index) => (
                    <LineBlock
                      key={line.steamIds.join("|")}
                      title={`${index + 1}ª pior line`}
                      line={line}
                      chemistry={line.chemistry}
                      profiles={profiles}
                      highlight={worstIn(line.steamIds)}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      ) : null}


      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Economia" hint="Aproveitamento por tipo de compra" />
          <ul className="space-y-3">
            {(["pistol", "eco", "force", "semi", "full"] as const).map((type) => {
              const slot = breakdown.buyType[type];
              if (!slot || slot.played === 0) return null;
              const rate = slot.won / slot.played;
              return (
                <li key={type}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span>{BUY_LABELS[type]}</span>
                    <span className="tnum text-fog-500">
                      <span className={rate >= 0.5 ? "text-win" : "text-loss"}>{pct(rate)}</span>{" "}
                      · {slot.won}/{slot.played}
                    </span>
                  </div>
                  <div className="mt-1.5">
                    <Meter value={rate} />
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <SectionTitle title="Últimas partidas" />
          <ul className="divide-y divide-ink-700/50">
            {recent.map((v) => (
              <li key={v.match.id}>
                <Link
                  href={`/matches/${v.match.id}`}
                  className="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-ink-800/60"
                >
                  <Pill tone={v.result === "win" ? "win" : v.result === "loss" ? "loss" : "neutral"}>
                    {v.result === "win" ? "V" : v.result === "loss" ? "D" : "E"}
                  </Pill>
                  <span className="flex-1 truncate text-sm">
                    <MapIcon map={v.match.map} className="mr-2 inline-grid size-5 align-text-bottom" />
                    <span className="font-medium">{mapLabel(v.match.map)}</span>
                    {v.opponent ? (
                      <span className="text-fog-500"> vs {v.opponent}</span>
                    ) : null}
                  </span>
                  <span className="tnum text-sm">
                    <span className={v.result === "win" ? "text-win" : "text-loss"}>{v.ourScore}</span>
                    <span className="text-fog-500">–{v.theirScore}</span>
                  </span>
                  <span className="hidden w-24 text-right text-xs text-fog-500 sm:block">
                    <LocalTime iso={v.date} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {leituras.length > 0 ? (
        <Card>
          <SectionTitle
            title="O que os números dizem para fazer"
            hint="Lido das partidas, não da opinião de ninguém. Recalculado a cada demo nova, então isto muda."
          />
          <ul className="space-y-4">
            {leituras.map((leitura) => (
              <li
                key={leitura.id}
                className={`rounded-lg border-l-2 bg-ink-850/60 px-4 py-3 ${
                  leitura.tone === "good" ? "border-win/70" : "border-loss/70"
                }`}
              >
                <p className="text-sm font-semibold text-fog-100">{leitura.finding}</p>
                <p className="mt-1 text-xs text-fog-500">{leitura.evidence}</p>
                <p className="mt-2 text-sm text-fog-300">{leitura.action}</p>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}

function LineBlock({
  title,
  line,
  chemistry,
  profiles,
  highlight,
}: {
  title: string;
  line: Lineup | LineChemistry;
  chemistry?: number;
  profiles: Profiles;
  highlight?: string | null;
}) {
  return (
    <div className="rounded-lg border border-ink-700 px-3 py-2">
      <div className="text-[11px] font-medium uppercase tracking-wider text-fog-500">{title}</div>
      <ul className="mt-1.5 space-y-1 text-sm">
        {line.steamIds.map((steamId, i) => (
          <li key={steamId} className="min-w-0">
            <Link
              href={`/players/${steamId}`}
              className={
                steamId === highlight
                  ? "text-loss transition-colors hover:text-fog-100"
                  : "transition-colors hover:text-fog-100"
              }
            >
              <PlayerTag
                name={steamId === highlight ? `${line.names[i]} 💩` : line.names[i]}
                avatar={profiles[steamId]?.avatar}
                size="size-6"
              />
            </Link>
          </li>
        ))}
      </ul>
      <div className="tnum mt-1 text-xs text-fog-500">
        {chemistry === undefined ? (
          <>
            <span className={line.winRate >= 0.5 ? "text-win" : "text-loss"}>
              {pct(line.winRate)}
            </span>{" "}
            · {line.wins}V de {line.played}
          </>
        ) : (
          <>
            <span className={chemistry >= 0.5 ? "text-win" : "text-loss"}>{pct(chemistry)}</span> de
            química · {line.played} partida{line.played === 1 ? "" : "s"} com os cinco juntos (
            {line.wins}V)
          </>
        )}
      </div>
      <div className="tnum text-xs text-fog-500">
        {line.roundsWon}-{line.roundsLost} em rounds
      </div>
    </div>
  );
}
