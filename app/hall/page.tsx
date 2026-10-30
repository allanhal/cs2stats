import Link from "next/link";
import {
  Avatar,
  Card,
  Empty,
  Pill,
  PlayerTag,
  SectionTitle,
  Table,
  Td,
  Th,
} from "@/components/ui";
import {
  aggregatePlayers,
  awards,
  killRecords,
  lobbyImpact,
  REGULATION_ROUNDS,
  type Award,
  type AwardMode,
  type KillRecord,
  type LobbyImpact,
  type OvertimeMode,
} from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { mapLabel, pct } from "@/lib/format";
import type { Profiles } from "@/lib/profiles";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

const MIN_WITH = 5;
const MIN_WITHOUT = 5;

export default async function HallPage({ searchParams }: PageProps<"/hall">) {
  const { views, tracked, config, profiles } = await loadDataset();

  const params = await searchParams;
  const mode: AwardMode = params.modo === "total" ? "total" : "round";
  const overtime: OvertimeMode = params.overtime === "sem" ? "sem" : "com";

  if (views.length === 0) {
    return (
      <Empty
        title="Nada pra zoar ainda"
        body="Depois da primeira demo aparece quem cegou os amigos, quem deu dano em aliado e quem carregou o time."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const players = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const lobby = lobbyImpact(views, tracked, { minPlayed: MIN_WITH, minAbsent: MIN_WITHOUT });
  const all = awards(players, mode);
  const records = killRecords(views, tracked, { overtime });
  const fame = all.filter((a) => a.tone === "fame");
  const shame = all.filter((a) => a.tone === "shame");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hall da fama e da vergonha</h1>
        <p className="mt-1 text-sm text-fog-500">
          {views.filter((v) => v.ourSquad).length} partidas de {config.teamName}.{" "}
          {mode === "round"
            ? "Cada número dividido pelos rounds jogados, para não premiar só quem apareceu mais."
            : "Tudo somado, sem dividir pelos rounds jogados."}
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-ink-700 p-0.5 text-xs">
          <ModeTab href={hallHref({ overtime })} label="Por round" active={mode === "round"} />
          <ModeTab
            href={hallHref({ mode: "total", overtime })}
            label="Total"
            active={mode === "total"}
          />
        </div>
      </div>

      <section>
        <SectionTitle
          title="Hall da vergonha"
          hint="Os números que ninguém quer no currículo"
          action={
            <Link href="/cartinhas/pior" className="text-xs text-fog-500 hover:text-fog-100">
              cartinha do pior →
            </Link>
          }
        />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shame.map((award) => (
            <AwardCard key={award.id} award={award} profiles={profiles} />
          ))}
        </div>
      </section>

      {lobby.length > 0 ? (
        <section>
          <SectionTitle
            title="Afunda lobby"
            hint={`Aproveitamento do time com e sem cada um, mais o KAST de quem jogou, a partir de ${MIN_WITH} partidas de cada lado. Não muda com o filtro acima.`}
          />
          <Card>
            <Table>
              <thead>
                <tr>
                  <Th align="left">Jogador</Th>
                  <Th>Com ele</Th>
                  <Th>Sem ele</Th>
                  <Th title="Diferença em pontos percentuais no aproveitamento de partidas">
                    Partidas
                  </Th>
                  <Th title="Diferença em pontos percentuais no aproveitamento de rounds">
                    Rounds
                  </Th>
                  <Th title="KAST do jogador e a diferença para a média do grupo">KAST</Th>
                </tr>
              </thead>
              <tbody>
                {lobby.map((row) => (
                  <LobbyRow key={row.steamId} row={row} profiles={profiles} />
                ))}
              </tbody>
            </Table>
            <p className="mt-3 text-[11px] text-fog-500">
              A ordem junta a queda no aproveitamento de rounds com o KAST do jogador contra a
              média do grupo, e quem tem poucas partidas de um dos lados pesa menos: com 5 de cada
              lado a diferença de rounds vale metade, e só vale inteira com muitas partidas. Ninguém
              perde partida sozinho.
            </p>
          </Card>
        </section>
      ) : null}

      <section>
        <SectionTitle title="Hall da fama" hint="Crédito onde é devido" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fame.map((award) => (
            <AwardCard key={award.id} award={award} profiles={profiles} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle
          title="Matou mais inimigos em 1 única partida"
          hint="A melhor partida de cada um, sem contar kill de aliado. Não muda com o filtro acima."
        />
        <Card>
          <div className="inline-flex rounded-lg border border-ink-700 p-0.5 text-xs">
            <ModeTab
              href={hallHref({ mode, overtime: "com" })}
              label="Com overtime"
              active={overtime === "com"}
            />
            <ModeTab
              href={hallHref({ mode, overtime: "sem" })}
              label="Sem overtime"
              active={overtime === "sem"}
            />
          </div>
          {records.length === 0 ? (
            <p className="mt-3 text-[11px] text-fog-500">
              {overtime === "sem"
                ? "Nenhuma partida decidida no tempo normal ainda."
                : "Nenhuma partida com kill registrada ainda."}
            </p>
          ) : (
            <>
              <div className="mt-3">
                <Table>
                  <thead>
                    <tr>
                      <Th align="left">#</Th>
                      <Th align="left">Jogador</Th>
                      <Th>Kills</Th>
                      <Th>Mortes</Th>
                      <Th>Rounds</Th>
                      <Th align="left">Partida</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.map((row, index) => (
                      <RecordRow
                        key={row.steamId}
                        row={row}
                        place={index + 1}
                        profiles={profiles}
                      />
                    ))}
                  </tbody>
                </Table>
              </div>
              <p className="mt-3 text-[11px] text-fog-500">
                {overtime === "com"
                  ? "Todas as partidas entram, inclusive as que foram para o overtime e deram mais rounds para matar."
                  : `Só partidas decididas no tempo normal, até ${REGULATION_ROUNDS} rounds.`}
              </p>
            </>
          )}
        </Card>
      </section>
    </div>
  );
}

function hallHref({ mode, overtime }: { mode?: AwardMode; overtime?: OvertimeMode }) {
  const query = new URLSearchParams();
  if (mode === "total") query.set("modo", "total");
  if (overtime === "sem") query.set("overtime", "sem");
  const search = query.toString();
  return search ? `/hall?${search}` : "/hall";
}

function RecordRow({
  row,
  place,
  profiles,
}: {
  row: KillRecord;
  place: number;
  profiles: Profiles;
}) {
  return (
    <tr>
      <Td align="left" className="text-fog-500">
        {place}
      </Td>
      <Td align="left">
        <Link href={`/players/${row.steamId}`} className="hover:text-fog-100">
          <PlayerTag name={row.name} avatar={profiles[row.steamId]?.avatar} />
        </Link>
      </Td>
      <Td className="font-semibold">{row.kills}</Td>
      <Td className="text-fog-500">{row.deaths}</Td>
      <Td className="text-fog-500">{row.rounds}</Td>
      <Td align="left">
        <Link href={`/matches/${row.matchId}`} className="text-fog-300 hover:text-fog-100">
          {mapLabel(row.map)}{" "}
          <span className={row.result === "win" ? "text-win" : row.result === "loss" ? "text-loss" : "text-fog-500"}>
            {row.ourScore}-{row.theirScore}
          </span>{" "}
          <span className="text-fog-500">· <LocalTime iso={row.playedAt} /></span>
          {row.overtime ? <span className="text-fog-500"> · OT</span> : null}
        </Link>
      </Td>
    </tr>
  );
}

function gapLabel(value: number, digits = 0) {
  const points = value * 100;
  return `${points > 0 ? "+" : points < 0 ? "-" : ""}${Math.abs(points).toFixed(digits)} pp`;
}

function gapTone(value: number) {
  return value < 0 ? "text-loss" : value > 0 ? "text-win" : "text-fog-500";
}

function LobbyRow({ row, profiles }: { row: LobbyImpact; profiles: Profiles }) {
  return (
    <tr>
      <Td align="left">
        <Link href={`/players/${row.steamId}`} className="hover:text-fog-100">
          <PlayerTag name={row.name} avatar={profiles[row.steamId]?.avatar} />
        </Link>
      </Td>
      <Td>
        {pct(row.winRate)}{" "}
        <span className="text-fog-500">
          ({row.wins}/{row.played})
        </span>
      </Td>
      <Td>
        {pct(row.absentWinRate)}{" "}
        <span className="text-fog-500">
          ({row.absentWins}/{row.absentPlayed})
        </span>
      </Td>
      <Td className={gapTone(row.winRateGap)}>{gapLabel(row.winRateGap)}</Td>
      <Td className={gapTone(row.roundWinRateGap)}>{gapLabel(row.roundWinRateGap, 1)}</Td>
      <Td>
        {pct(row.kast)}{" "}
        <span className={gapTone(row.kastGap)}>({gapLabel(row.kastGap, 1)})</span>
      </Td>
    </tr>
  );
}

function ModeTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 transition-colors ${
        active ? "bg-ink-800 text-fog-100" : "text-fog-500 hover:text-fog-100"
      }`}
    >
      {label}
    </Link>
  );
}

function AwardCard({ award, profiles }: { award: Award; profiles: Profiles }) {
  const leader = award.leader!;
  const runnersUp = award.board.slice(1, 4);
  const shame = award.tone === "shame";

  return (
    <Card className={shame ? "border-loss/25" : "border-win/25"}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{award.title}</h3>
          <p className="mt-0.5 text-[11px] text-fog-500">{award.hint}</p>
        </div>
        <Pill tone={shame ? "loss" : "win"}>{shame ? "vergonha" : "fama"}</Pill>
      </div>

      <Link
        href={`/players/${leader.steamId}`}
        className="mt-3 block rounded-lg bg-ink-850/70 px-3 py-2.5 transition-colors hover:bg-ink-800"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar src={profiles[leader.steamId]?.avatar} name={leader.name} className="size-7" />
          <span className="truncate text-base font-semibold">{leader.name}</span>
        </div>
        <div className="tnum mt-0.5 text-xs text-fog-500">{leader.label}</div>
      </Link>

      {runnersUp.length > 0 ? (
        <ol className="mt-2.5 space-y-1">
          {runnersUp.map((entry, index) => (
            <li key={entry.steamId} className="flex items-center gap-2 text-xs">
              <span className="tnum w-3 text-fog-500">{index + 2}</span>
              <Link
                href={`/players/${entry.steamId}`}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-fog-300 hover:text-fog-100"
              >
                <Avatar
                  src={profiles[entry.steamId]?.avatar}
                  name={entry.name}
                  className="size-4"
                />
                <span className="truncate">{entry.name}</span>
              </Link>
              <span className="tnum text-fog-500">{entry.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
