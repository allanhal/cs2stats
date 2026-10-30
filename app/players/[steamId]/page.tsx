import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar, Card, Meter, Pill, SectionTitle, Stat, Table, Td, Th } from "@/components/ui";
import { RatingChart } from "@/components/rating-chart";
import { RouteHeatmap } from "@/components/route-heatmap";
import { aggregatePlayers } from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { BUY_LABELS, dateLabel, mapLabel, num, pct, weaponLabel } from "@/lib/format";
import { radarFor } from "@/lib/radar";

export const dynamic = "force-dynamic";

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ steamId: string }>;
}) {
  const { steamId } = await params;
  const { views, config, profiles } = await loadDataset();

  const [player] = aggregatePlayers(views).filter((p) => p.steamId === steamId);
  if (!player) notFound();

  const appearances = views
    .map((v) => ({ view: v, stats: v.match.players.find((p) => p.steamId === steamId) }))
    .filter((x): x is { view: (typeof views)[number]; stats: NonNullable<typeof x.stats> } =>
      Boolean(x.stats),
    );

  const perMap = new Map<
    string,
    { map: string; matches: number; rounds: number; kills: number; deaths: number; damage: number; wins: number }
  >();
  for (const { view, stats } of appearances) {
    const key = view.match.map;
    const slot = perMap.get(key) ?? {
      map: key,
      matches: 0,
      rounds: 0,
      kills: 0,
      deaths: 0,
      damage: 0,
      wins: 0,
    };
    slot.matches++;
    slot.rounds += stats.roundsPlayed;
    slot.kills += stats.kills;
    slot.deaths += stats.deaths;
    slot.damage += stats.damage;
    const won = view.ourSquad === stats.squad ? view.result === "win" : view.result === "loss";
    if (won) slot.wins++;
    perMap.set(key, slot);
  }

  const weapons = Object.entries(player.weapons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);
  const topWeapon = weapons[0]?.[1] ?? 1;
  const weaponKills = weapons.reduce((a, [, kills]) => a + kills, 0);
  const buyRows = (["pistol", "eco", "force", "semi", "full"] as const)
    .map((buy) => ({ buy, ...player.byBuy[buy] }))
    .filter((row) => row.rounds > 0);
  const buyRounds = buyRows.reduce((a, row) => a + row.rounds, 0);
  const sideRows = (() => {
    const { CT, T } = player.bySide;
    const per = (v: number, rounds: number) => (rounds ? v / rounds : 0);
    return [
      { label: "Kills", ct: CT.kills, tr: T.kills, format: (v: number) => `${v}` },
      { label: "Deaths", ct: CT.deaths, tr: T.deaths, lowerIsBetter: true, format: (v: number) => `${v}` },
      {
        label: "K/D",
        ct: CT.kills / Math.max(CT.deaths, 1),
        tr: T.kills / Math.max(T.deaths, 1),
        format: (v: number) => num(v),
      },
      {
        label: "KPR",
        ct: per(CT.kills, CT.rounds),
        tr: per(T.kills, T.rounds),
        format: (v: number) => num(v),
      },
      {
        label: "ADR",
        ct: per(CT.damage, CT.rounds),
        tr: per(T.damage, T.rounds),
        format: (v: number) => v.toFixed(0),
      },
    ] as { label: string; ct: number; tr: number; lowerIsBetter?: boolean; format: (v: number) => string }[];
  })();
  const clutchTotal = Object.values(player.clutchesWon).reduce((a, b) => a + b, 0);
  const sniperRounds = Object.values(player.sniperRounds).reduce((a, b) => a + b, 0);
  const heatmapMaps = new Map<
    string,
    {
      radar: NonNullable<ReturnType<typeof radarFor>>;
      CT: { x: number; y: number; seconds: number }[];
      T: { x: number; y: number; seconds: number }[];
    }
  >();
  for (const [key, seconds] of Object.entries(player.heatmap)) {
    const [map, side, rawX, rawY] = key.split("|", 4);
    const radar = radarFor(map);
    const x = Number(rawX);
    const y = Number(rawY);
    if (!radar || (side !== "CT" && side !== "T") || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    const point = {
      x: ((x - radar.posX) / (radar.scale * 1024)) * 100,
      y: ((radar.posY - y) / (radar.scale * 1024)) * 100,
      seconds,
    };
    if (point.x < 0 || point.x > 100 || point.y < 0 || point.y > 100) continue;
    const entry = heatmapMaps.get(map) ?? { radar, CT: [], T: [] };
    entry[side].push(point);
    heatmapMaps.set(map, entry);
  }

  return (
    <div className="space-y-7">
      <div className="sticky top-28 z-10 -mx-4 border-y border-ink-700/70 bg-ink-950/95 px-4 py-3 backdrop-blur sm:top-[68px] sm:-mx-6 sm:px-6 print:static print:mx-0 print:border-x-0 print:bg-transparent print:px-0">
        <Link href="/players" className="text-xs text-fog-500 hover:text-fog-100">
          ← todos os jogadores
        </Link>
        <div className="mt-1 flex items-center gap-3">
          <Avatar
            src={profiles[player.steamId]?.avatar}
            name={player.name}
            className="size-8"
          />
          <h1 className="text-xl font-semibold tracking-tight">{player.name}</h1>
        </div>
        <p className="mt-1 text-sm text-fog-500">
          {player.matches} partida{player.matches === 1 ? "" : "s"} · {player.rounds} rounds ·
          SteamID{" "}
          <a
            href={`https://steamcommunity.com/profiles/${player.steamId}`}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-ink-700 underline-offset-2 transition-colors hover:text-fog-100"
          >
            {player.steamId}
          </a>
          {player.aliases.length > 1 ? ` · também conhecido como ${player.aliases.slice(0, -1).join(", ")}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Rating" value={num(player.rating)} tone={player.rating >= 1 ? "win" : "neutral"} />
        <Stat label="K/D" value={num(player.kd)} sub={`${player.kills}–${player.deaths}`} />
        <Stat label="ADR" value={player.adr.toFixed(0)} />
        <Stat label="KAST" value={pct(player.kast)} />
        <Stat label="HS%" value={pct(player.hsPercent)} />
        <Stat
          label="Vitórias"
          value={pct(player.winRate)}
          sub={`${player.wins}V · ${player.losses}D`}
          tone={player.winRate >= 0.5 ? "win" : "loss"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <SectionTitle title="Função no time" hint="O que os números dizem sobre o estilo de jogo" />
          <dl className="space-y-3 text-sm">
            <Row label="Entry kills">
              <SplitBar
                left={{ value: player.openingKills, label: "abertas" }}
                right={{ value: player.openingDeaths, label: "mortes abrindo" }}
              />
            </Row>
            <Row label="Round ganho após abrir">
              <ProgressBar
                value={player.openingKillRoundsWon}
                total={player.openingKills}
                label="rounds convertidos"
              />
            </Row>
            {player.sniperOpeningKills + player.sniperOpeningDeaths > 0 ? (
              <Row label="Abertura de sniper" value="AWP/Scout">
                <SplitBar
                  left={{ value: player.sniperOpeningKills, label: "abertas" }}
                  right={{ value: player.sniperOpeningDeaths, label: "perdidas" }}
                />
              </Row>
            ) : null}
            {sniperRounds > 0 ? (
              <div className="rounded-lg border border-ink-700/70 bg-ink-850/40 px-3 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <span className="text-fog-500">Com sniper</span>
                  <span className="tnum text-xs text-fog-500">
                    {sniperRounds} rounds com AWP/Scout ·{" "}
                    {pct(sniperRounds / Math.max(player.rounds, 1))} dos rounds
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-x-4">
                  <SniperStat
                    label="K/D"
                    sniper={player.sniperKills / Math.max(player.sniperDeaths, 1)}
                    overall={player.kd}
                    format={(v) => num(v)}
                  />
                  <SniperStat
                    label="Kills/round"
                    sniper={player.sniperKills / sniperRounds}
                    overall={player.kills / Math.max(player.rounds, 1)}
                    format={(v) => num(v)}
                  />
                  <SniperStat
                    label="Mortes/round"
                    sniper={player.sniperDeaths / sniperRounds}
                    overall={player.deaths / Math.max(player.rounds, 1)}
                    format={(v) => num(v)}
                    lowerIsBetter
                  />
                </div>
                <div className="mt-3 border-t border-ink-700/60 pt-3">
                  <div className="mb-2 text-[11px] uppercase tracking-wider text-fog-500">
                    Em que economia ele saca a sniper
                  </div>
                  <SniperUsage rounds={player.sniperRounds} won={player.sniperRoundsWon} />
                </div>
              </div>
            ) : null}
            <Row label="Clutches">
              <ProgressBar
                value={clutchTotal}
                total={player.clutchesPlayed}
                label="situações ganhas"
              />
            </Row>
            <Row label="Trocas" value="Vingança nos dois sentidos">
              <div className="mt-1 space-y-2">
                <div>
                  <div className="text-[11px] text-fog-500">Vinguei um companheiro</div>
                  <ProgressBar
                    value={player.tradeKills}
                    total={player.kills}
                    label="dos meus kills"
                  />
                </div>
                <div>
                  <div className="text-[11px] text-fog-500">O time me vingou</div>
                  <ProgressBar
                    value={player.tradedDeaths}
                    total={player.deaths}
                    label="das minhas mortes"
                  />
                </div>
              </div>
            </Row>
            <Row
              label="Utilitário"
              value={`${player.utilityDamage} de dano · ${player.enemiesFlashed} inimigos cegados · ${player.flashAssists} assists de flash`}
            />
            <Row
              label="Objetivo"
              value={`${player.bombsPlanted} bombas plantadas · ${player.bombsDefused} desarmadas · ${player.mvps} MVPs`}
            />
            <Row
              label="Multi-kills"
              value={`${player.multiKills.k2}× 2k · ${player.multiKills.k3}× 3k · ${player.multiKills.k4}× 4k · ${player.multiKills.k5}× ace`}
            />
          </dl>
        </Card>

        <Card>
          <SectionTitle title="CT vs TR" hint="Mesmo jogador, lados diferentes" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-baseline gap-2">
              <Pill tone="ct">CT</Pill>
              <span className="tnum text-xs text-fog-500">{player.bySide.CT.rounds} rounds</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="tnum text-xs text-fog-500">{player.bySide.T.rounds} rounds</span>
              <Pill tone="tr">TR</Pill>
            </div>
          </div>
          <div className="space-y-2.5">
            {sideRows.map((row) => {
              const max = Math.max(row.ct, row.tr, 0.0001);
              const ctLeads = row.lowerIsBetter ? row.ct < row.tr : row.ct > row.tr;
              const trLeads = row.lowerIsBetter ? row.tr < row.ct : row.tr > row.ct;
              return (
                <div key={row.label}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className={`tnum w-16 ${ctLeads ? "font-semibold text-ct" : "text-fog-300"}`}>
                      {row.format(row.ct)}
                    </span>
                    <span className="text-[11px] uppercase tracking-wider text-fog-500">
                      {row.label}
                    </span>
                    <span
                      className={`tnum w-16 text-right ${trLeads ? "font-semibold text-tr" : "text-fog-300"}`}
                    >
                      {row.format(row.tr)}
                    </span>
                  </div>
                  <div className="mt-1 flex gap-1">
                    <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-ink-700/70">
                      <div className="h-full rounded-full bg-ct" style={{ width: `${(row.ct / max) * 100}%` }} />
                    </div>
                    <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700/70">
                      <div className="h-full rounded-full bg-tr" style={{ width: `${(row.tr / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-5">
            <SectionTitle
              title="Armas favoritas"
              hint={`${weaponKills} kills com as ${weapons.length} mais usadas · ${num(weaponKills / Math.max(player.rounds, 1))} por round`}
            />
            <ul className="grid gap-x-6 gap-y-2.5 sm:grid-cols-2">
              {weapons.map(([weapon, kills]) => (
                <li key={weapon}>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span>{weaponLabel(weapon)}</span>
                    <span className="tnum text-fog-500">
                      {kills}
                      <span className="ml-1.5 text-xs text-fog-600">
                        {num(kills / Math.max(player.rounds, 1))}/round
                      </span>
                    </span>
                  </div>
                  <div className="mt-1">
                    <Meter value={kills / topWeapon} tone="neutral" />
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {buyRows.length > 0 ? (
        <Card>
          <SectionTitle
            title="Por tipo de compra"
            hint="Do pistol round ao full buy: quanto ele aparece e quanto rende em cada economia"
          />
          <div className="space-y-4">
            {buyRows.map((row) => (
              <div
                key={row.buy}
                className="grid gap-2 sm:grid-cols-[1fr_240px] sm:items-center sm:gap-5"
              >
                <div>
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="font-medium">{BUY_LABELS[row.buy]}</span>
                    <span className="tnum text-xs text-fog-500">
                      {row.rounds} rounds · {pct(row.rounds / Math.max(buyRounds, 1))} dos rounds
                    </span>
                  </div>
                  <ProgressBar value={row.won} total={row.rounds} label="rounds ganhos" />
                </div>
                <dl className="grid grid-cols-4 gap-2 text-right">
                  {[
                    ["K/D", num(row.kills / Math.max(row.deaths, 1))],
                    ["KPR", num(row.kills / row.rounds)],
                    ["ADR", (row.damage / row.rounds).toFixed(0)],
                    ["Kills", `${row.kills}`],
                  ].map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-[10px] uppercase tracking-wider text-fog-500">
                        {label}
                      </dt>
                      <dd className="tnum text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </Card>
      ) : null}

      {player.timeline.length >= 3 ? (
        <Card>
          <SectionTitle
            title="Forma ao longo do tempo"
            hint="Rating em cada partida, da mais antiga para a mais recente"
          />
          <RatingChart points={player.timeline} label={player.name} />
        </Card>
      ) : null}

      <Card>
        <SectionTitle
          title="Ficha corrida"
          hint="O que a demo registra e ninguém gostaria que registrasse"
        />
        <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
          <Fact
            label="Cegou os próprios colegas"
            value={`${player.teamFlashes}× · ${player.teamFlashSeconds.toFixed(1)}s`}
          />
          <Fact
            label="Cegou a si mesmo"
            value={`${player.selfFlashes}× · ${player.selfFlashSeconds.toFixed(1)}s`}
          />
          <Fact label="Dano em aliado" value={`${player.teamDamage}`} />
          <Fact label="Dano nas próprias granadas" value={`${player.selfDamage}`} />
          <Fact label="Team kills" value={`${player.teamKills}`} />
          <Fact label="Morto por aliado" value={`${player.teamKillDeaths}×`} />
          <Fact
            label="Rounds sem kill"
            value={`${player.zeroKillRounds} de ${player.rounds} (${pct(player.zeroKillRounds / Math.max(player.rounds, 1))})`}
          />
          <Fact label="Kills pelo smoke" value={`${player.throughSmokeKills}`} />
          <Fact label="Wallbangs" value={`${player.wallbangKills}`} />
          <Fact label="Kills cego" value={`${player.blindKills}`} />
          <Fact label="No-scopes" value={`${player.noScopeKills}`} />
          <Fact
            label="Inimigos cegados"
            value={`${player.enemiesFlashed} · ${player.enemyFlashSeconds.toFixed(1)}s`}
          />
        </div>
      </Card>

      {heatmapMaps.size > 0 ? (
        <section className="space-y-4">
          <SectionTitle
            title="Mapa de calor de rotas"
            hint="Cada ponto é uma posição amostrada por segundo; ficar mais tempo deixa o ponto maior e mais intenso"
          />
          {Array.from(heatmapMaps.entries())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([map, heatmap]) => (
              <Card key={map}>
                <SectionTitle title={mapLabel(map)} />
                <div className="grid gap-5 lg:grid-cols-2">
                  {(["CT", "T"] as const).map((side) => (
                    <div key={side}>
                      <Pill tone={side === "CT" ? "ct" : "tr"}>{side}</Pill>
                      <RouteHeatmap id={`${map}-${side}`} side={side} radar={heatmap.radar} points={heatmap[side]} />
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-[11px] text-fog-500">
                  Mapa vetorial por{" "}
                  <a
                    href="https://github.com/setposgg/cs2-minimaps"
                    target="_blank"
                    rel="noreferrer"
                    className="underline decoration-ink-700 underline-offset-2 hover:text-fog-100"
                  >
                    setpos.gg
                  </a>
                  . TSpawn e CTSpawn não entram na leitura.
                </p>
              </Card>
            ))}
        </section>
      ) : null}

      <Card>
        <SectionTitle title="Por mapa" />
        <Table>
          <thead>
            <tr>
              <Th align="left">Mapa</Th>
              <Th>Jogos</Th>
              <Th>Vitórias</Th>
              <Th>Rounds</Th>
              <Th>K–D</Th>
              <Th>KPR</Th>
              <Th>ADR</Th>
            </tr>
          </thead>
          <tbody>
            {Array.from(perMap.values())
              .sort((a, b) => b.matches - a.matches)
              .map((m) => (
                <tr key={m.map}>
                  <Td align="left" className="font-medium">
                    {mapLabel(m.map)}
                  </Td>
                  <Td>{m.matches}</Td>
                  <Td className={m.wins / m.matches >= 0.5 ? "text-win" : "text-loss"}>
                    {m.wins} ({pct(m.wins / m.matches)})
                  </Td>
                  <Td className="text-fog-500">{m.rounds}</Td>
                  <Td>
                    {m.kills}–{m.deaths}
                  </Td>
                  <Td>{num(m.rounds ? m.kills / m.rounds : 0)}</Td>
                  <Td>{(m.rounds ? m.damage / m.rounds : 0).toFixed(0)}</Td>
                </tr>
              ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <SectionTitle title="Histórico" hint={`Partidas de ${player.name} registradas em ${config.teamName}`} />
        <Table>
          <thead>
            <tr>
              <Th align="left">Data</Th>
              <Th align="left">Mapa</Th>
              <Th align="left">Resultado</Th>
              <Th>Placar</Th>
              <Th>K–D–A</Th>
              <Th>ADR</Th>
              <Th>KAST</Th>
            </tr>
          </thead>
          <tbody>
            {appearances.map(({ view, stats }) => {
              const won = view.ourSquad === stats.squad ? view.result === "win" : view.result === "loss";
              return (
                <tr key={view.match.id}>
                  <Td align="left" className="text-xs text-fog-500">
                    {dateLabel(view.date)}
                  </Td>
                  <Td align="left">
                    <Link href={`/matches/${view.match.id}`} className="hover:text-win">
                      {mapLabel(view.match.map)}
                    </Link>
                  </Td>
                  <Td align="left">
                    <Pill tone={won ? "win" : "loss"}>{won ? "Vitória" : "Derrota"}</Pill>
                  </Td>
                  <Td className="text-fog-500">
                    {view.ourScore}–{view.theirScore}
                  </Td>
                  <Td>
                    {stats.kills}–{stats.deaths}–{stats.assists}
                  </Td>
                  <Td>{(stats.damage / Math.max(stats.roundsPlayed, 1)).toFixed(0)}</Td>
                  <Td>{pct(stats.kastRounds / Math.max(stats.roundsPlayed, 1))}</Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2 border-b border-ink-700/40 pb-1.5 text-sm">
      <span className="text-fog-500">{label}</span>
      <span className="tnum font-medium">{value}</span>
    </div>
  );
}

function Row({
  label,
  value,
  meter,
  meterLabel,
  children,
}: {
  label: string;
  value?: string;
  meter?: number;

  meterLabel?: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <dt className="text-fog-500">{label}</dt>
        {value ? <dd className="tnum">{value}</dd> : null}
      </div>
      {meter !== undefined ? (
        <div className="mt-1.5 flex items-center gap-2">
          <div className="flex-1">
            <Meter value={meter} />
          </div>
          <span className="tnum shrink-0 text-[11px] text-fog-500">
            {pct(meter)}
            {meterLabel ? ` ${meterLabel}` : ""}
          </span>
        </div>
      ) : null}
      {children}
    </div>
  );
}

function SplitBar({
  left,
  right,
}: {
  left: { value: number; label: string };
  right: { value: number; label: string };
}) {
  const total = Math.max(left.value + right.value, 1);
  const share = left.value / total;

  return (
    <div className="mt-1.5 flex h-5 w-full overflow-hidden rounded-md bg-ink-700 text-[11px] font-medium text-ink-950">
      <div
        className="flex items-center overflow-hidden bg-win px-2"
        style={{ width: `${share * 100}%` }}
      >
        <span className="tnum truncate">
          {left.value} {left.label} · {pct(share)}
        </span>
      </div>
      <div
        className="flex items-center justify-end overflow-hidden bg-loss px-2"
        style={{ width: `${(1 - share) * 100}%` }}
      >
        <span className="tnum truncate">
          {right.value} {right.label}
        </span>
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const share = total > 0 ? Math.min(value / total, 1) : 0;

  return (
    <div className="relative mt-1.5 h-5 w-full overflow-hidden rounded-md bg-ink-700 text-[11px] font-medium">
      <div
        className={`h-full ${share >= 0.5 ? "bg-win" : "bg-loss"}`}
        style={{ width: `${share * 100}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-between gap-2 px-2">
        <span className={`tnum truncate ${share >= 0.3 ? "text-ink-950" : "text-fog-300"}`}>
          {value} de {total} {label}
        </span>
        <span className={`tnum shrink-0 ${share >= 0.92 ? "text-ink-950" : "text-fog-300"}`}>
          {pct(share)}
        </span>
      </div>
    </div>
  );
}

function SniperUsage({
  rounds,
  won,
}: {
  rounds: { full: number; semi: number; force: number; eco: number };
  won: { full: number; semi: number; force: number; eco: number };
}) {
  const entries = [
    { label: "Full buy", value: rounds.full, wins: won.full, color: "bg-win" },
    { label: "Semi buy", value: rounds.semi, wins: won.semi, color: "bg-ct" },
    { label: "Force", value: rounds.force, wins: won.force, color: "bg-tr" },
    { label: "Eco", value: rounds.eco, wins: won.eco, color: "bg-loss" },
  ];
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);

  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
      {entries.map((entry) => {
        const share = total > 0 ? entry.value / total : 0;
        const winRate = entry.value > 0 ? entry.wins / entry.value : 0;
        return (
          <div key={entry.label}>
            <div className="flex items-baseline justify-between gap-2 text-[11px] text-fog-500">
              <span>{entry.label}</span>
              <span className="tnum text-fog-300">
                {entry.value}
                <span className="ml-1 text-fog-500">{pct(share)}</span>
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded bg-ink-700">
              <div
                className={`h-full rounded ${entry.color}`}
                style={{ width: `${share * 100}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-baseline justify-between gap-2 text-[10px] text-fog-500">
              <span>{entry.wins} ganhos</span>
              <span className="tnum">{entry.value > 0 ? pct(winRate) : "—"}</span>
            </div>
            <div className="mt-0.5 h-1 overflow-hidden rounded bg-ink-700">
              <div
                className={`h-full rounded ${winRate >= 0.5 ? "bg-win" : "bg-loss"}`}
                style={{ width: `${winRate * 100}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SniperStat({
  label,
  sniper,
  overall,
  format,
  lowerIsBetter = false,
}: {
  label: string;
  sniper: number;
  overall: number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
}) {
  const max = Math.max(sniper, overall, 0.0001);
  const better = lowerIsBetter ? sniper < overall : sniper > overall;

  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-fog-500">{label}</div>
      <div className={`tnum mt-0.5 text-base font-semibold ${better ? "text-win" : "text-fog-100"}`}>
        {format(sniper)}
      </div>
      <div className="relative mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-700">
        <div
          className={`h-full rounded-full ${better ? "bg-win" : "bg-loss"}`}
          style={{ width: `${(sniper / max) * 100}%` }}
        />
        <span
          className="absolute inset-y-0 w-0.5 bg-fog-300"
          style={{ left: `${(overall / max) * 100}%` }}
        />
      </div>
      <div className="tnum mt-1 text-[10px] text-fog-500">geral {format(overall)}</div>
    </div>
  );
}
