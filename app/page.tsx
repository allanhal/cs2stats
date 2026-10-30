import Link from "next/link";
import {
  Card,
  Empty,
  PlayerTag,
  Meter,
  Pill,
  ProgressBar,
  SectionTitle,
  Stat,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { PlayerRanks, type RankRow } from "@/components/player-ranks";
import { FifaCard } from "@/components/fifa-card";
import {
  aggregatePlayers,
  awards,
  bestLines,
  worstLines,
  worstPlayers,
  lobbyImpact,
  byMap,
  callouts,
  lineups,
  openingRecord,
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
  const duos = lineups(views, tracked, { size: "pair", minPlayed: 2 });
  const bestDuos = duos.slice(0, 6);
  const worstDuos = duos
    .slice(bestDuos.length)
    .reverse()
    .slice(0, 6);
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
  const places = callouts(views);
  const opening = openingRecord(views);
  const shame = awards(players).filter((a) => a.tone === "shame");
  const streakLabel =
    t.currentStreak.kind === "win"
      ? `${t.currentStreak.length} vitória${t.currentStreak.length > 1 ? "s" : ""} seguida${t.currentStreak.length > 1 ? "s" : ""}`
      : t.currentStreak.kind === "loss"
        ? `${t.currentStreak.length} derrota${t.currentStreak.length > 1 ? "s" : ""} seguida${t.currentStreak.length > 1 ? "s" : ""}`
        : "—";

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{config.teamName}</h1>
        <p className="mt-1 text-sm text-fog-500">
          {t.matches} partida{t.matches === 1 ? "" : "s"} analisada
          {t.matches === 1 ? "" : "s"} · {maps.length} mapa{maps.length === 1 ? "" : "s"} ·{" "}
          {players.length} jogador{players.length === 1 ? "" : "es"} no grupo
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat
          label="Aproveitamento"
          value={pct(t.winRate)}
          sub={`${t.wins}V · ${t.losses}D${t.ties ? ` · ${t.ties}E` : ""}`}
          tone={t.winRate >= 0.5 ? "win" : "loss"}
        />
        <Stat
          label="Rounds"
          value={pct(t.roundWinRate)}
          sub={`${t.roundsWon} ganhos · ${t.roundsLost} perdidos`}
        />
        <Stat
          label="Como CT"
          value={pct(t.bySide.CT.played ? t.bySide.CT.won / t.bySide.CT.played : 0)}
          sub={`${t.bySide.CT.won}/${t.bySide.CT.played} rounds`}
        />
        <Stat
          label="Como TR"
          value={pct(t.bySide.T.played ? t.bySide.T.won / t.bySide.T.played : 0)}
          sub={`${t.bySide.T.won}/${t.bySide.T.played} rounds`}
        />
        <Stat
          label="Sequência atual"
          value={t.currentStreak.length || "—"}
          sub={streakLabel}
          tone={t.currentStreak.kind === "win" ? "win" : t.currentStreak.kind === "loss" ? "loss" : "neutral"}
        />
      </div>

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
                  {mapLabel(m.map)}
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

      {opening.advantage.played + opening.disadvantage.played > 0 ? (
        <Card>
          <SectionTitle
            title="Depois da primeira kill"
            hint="O que o time faz com a vantagem numérica, e o que faz quando ela é do outro lado"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm">5v4 · abrimos o round</div>
              <ProgressBar
                value={opening.advantage.won}
                total={opening.advantage.played}
                label="rounds ganhos"
              />
            </div>
            <div>
              <div className="text-sm">4v5 · levamos a primeira</div>
              <ProgressBar
                value={opening.disadvantage.won}
                total={opening.disadvantage.played}
                label="rounds ganhos"
              />
            </div>
            <div>
              <div className="text-sm">Resiliência · adversário fez multi-kill</div>
              <ProgressBar
                value={opening.resilience.won}
                total={opening.resilience.played}
                label="rounds ganhos mesmo assim"
              />
            </div>
            <div>
              <div className="text-sm">Nosso multi-kill</div>
              <ProgressBar
                value={opening.dominance.won}
                total={opening.dominance.played}
                label="rounds ganhos"
              />
            </div>
          </div>
          <p className="mt-3 text-[11px] text-fog-500">
            Perder muito em 5v4 é falha de retrade e de comunicação; ganhar em 4v5 e depois de levar
            um multi-kill é o oposto disso.
          </p>
        </Card>
      ) : null}

      {places.length > 0 ? (
        <Card>
          <SectionTitle
            title="Onde os duelos acontecem"
            hint="Pelos callouts que a própria demo registra em cada kill, somando todos os mapas"
          />
          <ul className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
            {places.slice(0, 12).map((place) => {
              const total = place.kills + place.deaths;
              return (
                <li key={place.place}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate">{place.place}</span>
                    <span className="tnum text-xs text-fog-500">
                      <span className="text-win">{place.kills}</span>
                      <span>/</span>
                      <span className="text-loss">{place.deaths}</span>
                      {place.diff !== 0 ? (
                        <span className={place.diff > 0 ? "text-win" : "text-loss"}>
                          {" "}
                          {place.diff > 0 ? "+" : ""}
                          {place.diff}
                        </span>
                      ) : null}
                    </span>
                  </div>
                  <div className="mt-1 flex h-1.5 overflow-hidden rounded-full bg-ink-700">
                    <div className="bg-win" style={{ width: `${(place.kills / total) * 100}%` }} />
                    <div className="bg-loss" style={{ width: `${(place.deaths / total) * 100}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[11px] text-fog-500">
            Verde = kills nossas no local, vermelho = nossas mortes. Um saldo negativo num callout é
            onde vale rever o posicionamento.
          </p>
        </Card>
      ) : null}

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

      {duos.length > 0 ? (
        <Card>
          <SectionTitle
            title="Duplas"
            hint="Aproveitamento por par de jogadores. Com poucas partidas isso é mais curiosidade que conclusão."
          />
          <div className="space-y-4">
            <DuoGroup title="As que mais ganham" duos={bestDuos} tone="win" />
            {worstDuos.length > 0 ? (
              <DuoGroup title="As que mais perdem" duos={worstDuos} tone="loss" />
            ) : null}
          </div>
        </Card>
      ) : null}

      {shame.length > 0 ? (
        <Card>
          <SectionTitle
            title="Hall da vergonha"
            hint="Os destaques que ninguém pediu"
            action={
              <Link href="/hall" className="text-xs text-fog-500 hover:text-fog-100">
                ver tudo →
              </Link>
            }
          />
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {shame.slice(0, 6).map((award) => (
              <div
                key={award.id}
                className="rounded-lg border border-loss/20 bg-loss/5 px-3 py-2"
                title={award.hint}
              >
                <div className="text-[11px] font-medium uppercase tracking-wider text-loss">
                  {award.title}
                </div>
                <div className="mt-0.5 text-[11px] text-fog-500">{award.hint}</div>
                <div className="mt-1.5 truncate text-sm font-semibold">{award.leader!.name}</div>
                <div className="tnum text-xs text-fog-500">{award.leader!.label}</div>
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

function DuoGroup({
  title,
  duos,
  tone,
}: {
  title: string;
  duos: Lineup[];
  tone: "win" | "loss";
}) {
  return (
    <div>
      <div
        className={`mb-2 text-[11px] font-medium uppercase tracking-wider ${
          tone === "win" ? "text-win" : "text-loss"
        }`}
      >
        {title}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {duos.map((duo) => (
          <div
            key={duo.steamIds.join("|")}
            className={`rounded-lg border px-3 py-2 ${
              tone === "win" ? "border-win/20 bg-win/5" : "border-loss/20 bg-loss/5"
            }`}
          >
            <div className="truncate text-sm">{duo.names.join(" + ")}</div>
            <div className="tnum mt-0.5 text-xs text-fog-500">
              <span className={duo.winRate >= 0.5 ? "text-win" : "text-loss"}>
                {pct(duo.winRate)}
              </span>{" "}
              · {duo.wins}V de {duo.played}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
