import Link from "next/link";
import {
  Card,
  Empty,
  MapTag,
  Pill,
  SectionTitle,
  Table,
  Td,
  Th,
} from "@/components/ui";
import { MatchSource } from "@/components/match-source";
import { loadDataset } from "@/lib/data";
import { duration } from "@/lib/format";
import { LocalTime } from "@/components/local-time";

export const dynamic = "force-dynamic";

export default async function MatchesPage() {
  const { views } = await loadDataset();

  if (views.length === 0) {
    return (
      <Empty
        title="Nenhuma partida"
        body="Assim que uma demo for enviada ela aparece aqui com placar, rounds e presença."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  return (
    <Card>
      <SectionTitle
        title="Partidas"
        hint={`${views.length} demos processadas`}
        action={
          <Link href="/matches/premier" className="text-sm text-fog-300 hover:text-win">
            Histórico Premier →
          </Link>
        }
      />
      <Table>
        <thead>
          <tr>
            <Th align="left">Resultado</Th>
            <Th align="left">Mapa</Th>
            <Th align="left">Adversário</Th>
            <Th align="left">Origem</Th>
            <Th>Placar</Th>
            <Th>Rounds</Th>
            <Th>Duração</Th>
            <Th align="left">Presentes</Th>
            <Th align="left">Enviado por</Th>
            <Th align="left">Data</Th>
          </tr>
        </thead>
        <tbody>
          {views.map((v) => (
            <tr key={v.match.id} className="group">
              <Td align="left">
                <Pill tone={v.result === "win" ? "win" : v.result === "loss" ? "loss" : "neutral"}>
                  {v.result === "win" ? "Vitória" : v.result === "loss" ? "Derrota" : "Empate"}
                </Pill>
              </Td>
              <Td align="left" className="font-medium">
                <Link href={`/matches/${v.match.id}`} className="hover:text-win">
                  <MapTag map={v.match.map} size="size-5" />
                </Link>
              </Td>
              <Td align="left" className="max-w-[170px] truncate text-xs text-fog-500">
                {v.opponent || "—"}
              </Td>
              <Td align="left" className="text-xs">
                <MatchSource match={v.match} />
              </Td>
              <Td>
                <span className={v.result === "win" ? "text-win" : "text-loss"}>{v.ourScore}</span>
                <span className="text-fog-500">–{v.theirScore}</span>
              </Td>
              <Td className="text-fog-500">{v.match.totalRounds}</Td>
              <Td className="text-fog-500">{duration(v.match.durationSeconds)}</Td>
              <Td align="left" className="max-w-[260px] truncate text-xs text-fog-500">
                {v.ourPlayers.map((p) => p.name).join(", ") || "—"}
              </Td>
              <Td align="left" className="text-xs text-fog-500">
                {v.match.uploadedBy}
              </Td>
              <Td align="left" className="text-xs text-fog-500">
                <LocalTime iso={v.date} />
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}
