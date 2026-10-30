"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, SectionTitle, Table, Td, Th } from "@/components/ui";
import { num, pct } from "@/lib/format";

export type RankRow = {
  steamId: string;
  name: string;
  matches: number;
  rating: number;
  kills: number;
  deaths: number;
  assists: number;
  kd: number;
  adr: number;
  kast: number;
  hsPercent: number;
  openingKills: number;
  openingDeaths: number;
  clutchesWon: number;
  clutchesPlayed: number;
};

export function PlayerRanks({ rows, minMatches }: { rows: RankRow[]; minMatches: number }) {
  const veterans = rows.filter((p) => p.matches >= minMatches);
  const [showEveryone, setShowEveryone] = useState(veterans.length === 0);
  const ranked = showEveryone || veterans.length === 0 ? rows : veterans;

  return (
    <Card>
      <SectionTitle
        title="Jogadores"
        hint={
          showEveryone
            ? "Todo mundo do grupo, inclusive quem jogou pouco. Rating é a aproximação pública do HLTV 2.0."
            : `Só quem já tem ${minMatches} partidas, para uma noite boa não virar líder do rating.`
        }
        action={
          <div className="flex items-center gap-3">
            <div className="inline-flex rounded-lg border border-ink-700 p-0.5 text-xs">
              <RankTab
                label={`${minMatches}+ partidas`}
                active={!showEveryone}
                onClick={() => setShowEveryone(false)}
              />
              <RankTab
                label="Geral"
                active={showEveryone}
                onClick={() => setShowEveryone(true)}
              />
            </div>
            <Link href="/players" className="text-xs text-fog-500 hover:text-fog-100">
              detalhes →
            </Link>
          </div>
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
          {ranked.map((p) => (
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
                {p.clutchesWon}/{p.clutchesPlayed}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Card>
  );
}

function RankTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1 transition-colors ${
        active ? "bg-ink-800 text-fog-100" : "text-fog-500 hover:text-fog-100"
      }`}
    >
      {label}
    </button>
  );
}
