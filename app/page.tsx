import Link from "next/link";
import { Card, Empty, Meter, Pill, SectionTitle, Stat, Table, Td, Th } from "@/components/ui";
import {
  aggregatePlayers,
  awards,
  byMap,
  callouts,
  lineups,
  roundBreakdown,
  totals,
  type Lineup,
} from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { insights } from "@/lib/insights";
import { BUY_LABELS, dateLabel, mapLabel, num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { views, tracked, config } = await loadDataset();
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
  const breakdown = roundBreakdown(views);
  const recent = views.slice(0, 6);
  const duos = lineups(views, tracked, { size: "pair", minPlayed: 2 });
  const bestDuos = duos.slice(0, 6);
  const worstDuos = duos
    .slice(bestDuos.length)
    .reverse()
    .slice(0, 6);
  const places = callouts(views);
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
              <Th>V–D</Th>
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

      <Card>
        <SectionTitle
          title="Jogadores"
          hint="Média por round somando todas as partidas. Rating é a aproximação pública do HLTV 2.0."
          action={
            <Link href="/players" className="text-xs text-fog-500 hover:text-fog-100">
              detalhes →
            </Link>
          }
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Jogador</Th>
              <Th title="Partidas presentes">Jogos</Th>
              <Th>Rating</Th>
              <Th title="Kills / Deaths / Assists">K–D–A</Th>
              <Th>K/D</Th>
              <Th title="Dano médio por round">ADR</Th>
              <Th title="Rounds com kill, assist, sobrevivência ou troca">KAST</Th>
              <Th title="Porcentagem de kills na cabeça">HS%</Th>
              <Th title="Primeiras kills do round">Entry</Th>
              <Th title="Clutches ganhos / jogados">Clutch</Th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr key={p.steamId}>
                <Td align="left" className="font-medium">
                  <Link href={`/players/${p.steamId}`} className="hover:text-win">
                    {p.name}
                  </Link>
                </Td>
                <Td className="text-fog-500">{p.matches}</Td>
                <Td className={p.rating >= 1 ? "font-semibold text-win" : "font-semibold"}>
                  {num(p.rating)}
                </Td>
                <Td>
                  {p.kills}–{p.deaths}–{p.assists}
                </Td>
                <Td className={p.kd >= 1 ? "text-win" : "text-loss"}>{num(p.kd)}</Td>
                <Td>{p.adr.toFixed(0)}</Td>
                <Td>{pct(p.kast)}</Td>
                <Td>{pct(p.hsPercent)}</Td>
                <Td className="text-fog-500">
                  {p.openingKills}/{p.openingDeaths}
                </Td>
                <Td className="text-fog-500">
                  {Object.values(p.clutchesWon).reduce((a, b) => a + b, 0)}/{p.clutchesPlayed}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

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
                    {dateLabel(v.date)}
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
