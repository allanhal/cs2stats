import Link from "next/link";
import { Card, Empty, Meter, PlayerTag, SectionTitle, Table, Td, Th } from "@/components/ui";
import { aggregatePlayers } from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function PlayersPage() {
  const { views, tracked, config, profiles } = await loadDataset();

  if (views.length === 0) {
    return (
      <Empty
        title="Sem jogadores ainda"
        body="Os jogadores aparecem aqui depois do primeiro upload."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const ours = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const everyone = aggregatePlayers(views).filter((p) => !tracked.has(p.steamId));
  const totalMatches = views.filter((v) => v.ourSquad).length;

  return (
    <div className="space-y-7">
      <Card>
        <SectionTitle
          title={config.teamName}
          hint="Presença, consistência e desempenho acumulado em todas as partidas"
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Jogador</Th>
              <Th title="Partidas jogadas e presença no total de partidas">Presença</Th>
              <Th>V–D</Th>
              <Th title="Aproveitamento nas partidas em que jogou">Win%</Th>
              <Th>Rating</Th>
              <Th title="Kills por round">KPR</Th>
              <Th title="Deaths por round">DPR</Th>
              <Th>ADR</Th>
              <Th>KAST</Th>
              <Th>HS%</Th>
              <Th title="Entry kills / entry deaths">Entry</Th>
              <Th title="Rounds ganhos após abrir o round">Entry win%</Th>
              <Th title="Clutches ganhos">Clutch</Th>
              <Th title="Kills trocadas / mortes trocadas">Trade</Th>
            </tr>
          </thead>
          <tbody>
            {ours.map((p) => (
              <tr key={p.steamId}>
                <Td align="left" className="font-medium">
                  <Link href={`/players/${p.steamId}`} className="hover:text-win">
                    <PlayerTag name={p.name} avatar={profiles[p.steamId]?.avatar} />
                  </Link>
                </Td>
                <Td>
                  <div className="flex items-center justify-end gap-2">
                    <span>
                      {p.matches}
                      <span className="text-fog-500">/{totalMatches}</span>
                    </span>
                    <div className="w-10">
                      <Meter value={totalMatches ? p.matches / totalMatches : 0} tone="neutral" />
                    </div>
                  </div>
                </Td>
                <Td>
                  <span className="text-win">{p.wins}</span>
                  <span className="text-fog-500">–</span>
                  <span className="text-loss">{p.losses}</span>
                </Td>
                <Td className={p.winRate >= 0.5 ? "text-win" : "text-loss"}>{pct(p.winRate)}</Td>
                <Td className="font-semibold">{num(p.rating)}</Td>
                <Td>{num(p.kpr)}</Td>
                <Td>{num(p.dpr)}</Td>
                <Td>{p.adr.toFixed(0)}</Td>
                <Td>{pct(p.kast)}</Td>
                <Td>{pct(p.hsPercent)}</Td>
                <Td className="text-fog-500">
                  {p.openingKills}/{p.openingDeaths}
                </Td>
                <Td>{pct(p.openingWinRate)}</Td>
                <Td className="text-fog-500">
                  {Object.values(p.clutchesWon).reduce((a, b) => a + b, 0)}/{p.clutchesPlayed}
                </Td>
                <Td className="text-fog-500">
                  {p.tradeKills}/{p.tradedDeaths}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      {everyone.length > 0 ? (
        <Card>
          <SectionTitle
            title="Adversários e avulsos"
            hint="Todo mundo que apareceu nas demos mas não está marcado como parte do grupo"
          />
          <Table>
            <thead>
              <tr>
                <Th align="left">Jogador</Th>
                <Th>Jogos</Th>
                <Th>Rating</Th>
                <Th>K–D</Th>
                <Th>ADR</Th>
                <Th>HS%</Th>
              </tr>
            </thead>
            <tbody>
              {everyone.slice(0, 40).map((p) => (
                <tr key={p.steamId}>
                  <Td align="left">
                    <Link href={`/players/${p.steamId}`} className="hover:text-win">
                      <PlayerTag name={p.name} avatar={profiles[p.steamId]?.avatar} size="size-5" />
                    </Link>
                  </Td>
                  <Td className="text-fog-500">{p.matches}</Td>
                  <Td>{num(p.rating)}</Td>
                  <Td>
                    {p.kills}–{p.deaths}
                  </Td>
                  <Td>{p.adr.toFixed(0)}</Td>
                  <Td>{pct(p.hsPercent)}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
          {everyone.length > 40 ? (
            <p className="mt-3 text-[11px] text-fog-500">
              Mostrando 40 de {everyone.length}. Marque quem é do grupo em /admin.
            </p>
          ) : null}
        </Card>
      ) : null}
    </div>
  );
}
