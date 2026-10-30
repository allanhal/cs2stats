"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Card, Pill, SectionTitle, Table, Td, Th } from "@/components/ui";
import { bytes, dateLabel, dateTimeLabel, mapLabel } from "@/lib/format";

export interface AdminMatch {
  id: string;
  map: string;
  ourScore: number;
  theirScore: number;
  result: "win" | "loss" | "tie" | null;
  opponent: string;
  rounds: number;
  playedAt: string;
  playedAtKnown: boolean;
  uploadedAt: string;
  uploadedBy: string;
  fileName: string;
  fileSizeBytes: number;
}

export interface AdminPlayer {
  steamId: string;
  name: string;
  rawNames: string[];
  matches: number;
  tracked: boolean;
  hidden: boolean;
  customName: string | null;
  merged: { steamId: string; names: string[]; hidden: boolean }[];
}

interface Draft {
  teamName: string;
  tracked: Set<string>;
  hidden: Set<string>;
  names: Record<string, string>;

  aliases: Record<string, string>;
}

export function AdminPanel({
  matches,
  players,
  teamName,
  autoDetected,
}: {
  matches: AdminMatch[];
  players: AdminPlayer[];
  teamName: string;
  autoDetected: boolean;
}) {
  const router = useRouter();

  const initial = useMemo<Draft>(
    () => ({
      teamName,
      tracked: new Set(players.filter((p) => p.tracked).map((p) => p.steamId)),
      hidden: new Set([
        ...players.filter((p) => p.hidden).map((p) => p.steamId),
        ...players.flatMap((p) => p.merged.filter((m) => m.hidden).map((m) => m.steamId)),
      ]),
      names: Object.fromEntries(
        players.filter((p) => p.customName).map((p) => [p.steamId, p.customName as string]),
      ),
      aliases: Object.fromEntries(
        players.flatMap((p) => p.merged.map((m) => [m.steamId, p.steamId])),
      ),
    }),
    [players, teamName],
  );

  const [draft, setDraft] = useState<Draft>(initial);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [keepId, setKeepId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const dirty = useMemo(() => {
    const sameSet = (a: Set<string>, b: Set<string>) =>
      a.size === b.size && Array.from(a).every((v) => b.has(v));
    return (
      draft.teamName !== initial.teamName ||
      !sameSet(draft.tracked, initial.tracked) ||
      !sameSet(draft.hidden, initial.hidden) ||
      JSON.stringify(draft.names) !== JSON.stringify(initial.names) ||
      JSON.stringify(draft.aliases) !== JSON.stringify(initial.aliases)
    );
  }, [draft, initial]);

  const update = (patch: Partial<Draft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setSaved(false);
  };

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  function merge() {
    const ids = Array.from(selected);
    const keep = keepId || ids[0];
    if (ids.length < 2 || !ids.includes(keep)) return;
    const aliases = { ...draft.aliases };
    for (const id of ids) {
      if (id === keep) continue;
      aliases[id] = keep;

      for (const [alt, target] of Object.entries(aliases)) {
        if (target === id) aliases[alt] = keep;
      }
    }
    update({ aliases });
    setSelected(new Set());
    setKeepId("");
  }

  function unmerge(player: AdminPlayer) {
    const aliases = { ...draft.aliases };
    for (const alternate of player.merged) delete aliases[alternate.steamId];
    update({ aliases });
  }

  async function save() {
    setSaving(true);
    const response = await fetch("/api/admin/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        teamName: draft.teamName,
        trackedSteamIds: Array.from(draft.tracked),
        hiddenSteamIds: Array.from(draft.hidden),
        aliases: draft.aliases,
        displayNames: draft.names,
      }),
    });
    setSaving(false);
    if (response.ok) {
      setSaved(true);
      router.refresh();
    } else {
      window.alert("Não foi possível salvar as alterações.");
    }
  }

  async function removeMatch(match: AdminMatch) {
    const ok = window.confirm(
      `Apagar a partida de ${mapLabel(match.map)} (${match.ourScore}–${match.theirScore}) contra ${match.opponent || "adversário desconhecido"}?\n\nIsso remove as estatísticas dessa partida de todas as páginas. A demo já foi descartada no upload, então não tem como reprocessar — só reenviando o arquivo.`,
    );
    if (!ok) return;
    setRemoving(match.id);
    const response = await fetch(`/api/admin/matches/${match.id}`, { method: "DELETE" });
    setRemoving(null);
    if (response.ok) router.refresh();
    else window.alert("Não foi possível apagar essa partida.");
  }

  const visiblePlayers = players.filter((p) => !draft.aliases[p.steamId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <div className="flex items-center gap-3">
          {dirty ? <span className="text-xs text-tr">alterações não salvas</span> : null}
          {saved && !dirty ? <span className="text-xs text-win">salvo</span> : null}
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="rounded-lg bg-win px-3.5 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90 disabled:opacity-30"
          >
            {saving ? "Salvando…" : "Salvar"}
          </button>
          <button
            type="button"
            onClick={async () => {
              await fetch("/api/admin/logout", { method: "POST" });
              router.refresh();
            }}
            className="rounded-lg border border-ink-700 px-3 py-1.5 text-sm text-fog-500 transition-colors hover:bg-ink-800 hover:text-fog-100"
          >
            Sair
          </button>
        </div>
      </div>

      <Card>
        <SectionTitle title="Nome do time" />
        <input
          value={draft.teamName}
          onChange={(e) => update({ teamName: e.target.value })}
          maxLength={40}
          className="w-full max-w-xs rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none focus:border-win/60"
        />
      </Card>

      <Card>
        <SectionTitle
          title="Jogadores"
          hint={
            autoDetected
              ? "Nenhum time fixado: estamos detectando pelos jogadores que mais aparecem. Marque “do time” para fixar."
              : "Marque quem é do time, esconda quem não deve contar, e mescle contas da mesma pessoa."
          }
        />

        {selected.size >= 2 ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-win/30 bg-win/5 px-3 py-2.5 text-sm">
            <span>
              Mesclar {selected.size} jogadores em um só, mantendo:
            </span>
            <select
              value={keepId || Array.from(selected)[0]}
              onChange={(e) => setKeepId(e.target.value)}
              className="rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-sm outline-none"
            >
              {Array.from(selected).map((id) => (
                <option key={id} value={id}>
                  {players.find((p) => p.steamId === id)?.name ?? id}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={merge}
              className="rounded-md bg-win px-2.5 py-1 text-xs font-semibold text-ink-950"
            >
              Mesclar
            </button>
            <button
              type="button"
              onClick={() => {
                setSelected(new Set());
                setKeepId("");
              }}
              className="text-xs text-fog-500 hover:text-fog-100"
            >
              cancelar
            </button>
          </div>
        ) : null}

        <Table>
          <thead>
            <tr>
              <Th align="left">&nbsp;</Th>
              <Th align="left">Nome exibido</Th>
              <Th align="left">SteamID</Th>
              <Th>Partidas</Th>
              <Th align="left">Do time</Th>
              <Th align="left">Esconder</Th>
              <Th align="left">Contas mescladas</Th>
            </tr>
          </thead>
          <tbody>
            {visiblePlayers.map((player) => {
              const merged = Object.entries(draft.aliases)
                .filter(([, target]) => target === player.steamId)
                .map(([alt]) => alt);
              const hidden = draft.hidden.has(player.steamId);
              return (
                <tr key={player.steamId} className={hidden ? "opacity-45" : ""}>
                  <Td align="left">
                    <input
                      type="checkbox"
                      checked={selected.has(player.steamId)}
                      onChange={() => setSelected(toggle(selected, player.steamId))}
                      aria-label={`selecionar ${player.name} para mesclar`}
                      className="size-4 accent-[var(--color-win)]"
                    />
                  </Td>
                  <Td align="left">
                    <input
                      value={draft.names[player.steamId] ?? player.name}
                      onChange={(e) => {
                        const names = { ...draft.names };
                        const value = e.target.value;
                        if (value.trim().length === 0) delete names[player.steamId];
                        else names[player.steamId] = value;
                        update({ names });
                      }}
                      maxLength={40}
                      className="w-40 rounded-md border border-ink-700 bg-ink-850 px-2 py-1 text-sm outline-none focus:border-win/60"
                    />
                    {player.rawNames.length > 1 ? (
                      <div className="mt-1 max-w-40 truncate text-[11px] text-fog-500">
                        nicks: {player.rawNames.join(", ")}
                      </div>
                    ) : null}
                  </Td>
                  <Td align="left" className="font-mono text-[11px] text-fog-500">
                    {player.steamId}
                  </Td>
                  <Td className="text-fog-500">{player.matches}</Td>
                  <Td align="left">
                    <input
                      type="checkbox"
                      checked={draft.tracked.has(player.steamId)}
                      onChange={() => update({ tracked: toggle(draft.tracked, player.steamId) })}
                      aria-label={`${player.name} faz parte do time`}
                      className="size-4 accent-[var(--color-win)]"
                    />
                  </Td>
                  <Td align="left">
                    <input
                      type="checkbox"
                      checked={hidden}
                      onChange={() => update({ hidden: toggle(draft.hidden, player.steamId) })}
                      aria-label={`esconder ${player.name} das estatísticas`}
                      className="size-4 accent-[var(--color-loss)]"
                    />
                  </Td>
                  <Td align="left">
                    {merged.length > 0 ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] text-fog-500">
                          +{merged.length}
                        </span>
                        <button
                          type="button"
                          onClick={() => unmerge({ ...player, merged: merged.map((steamId) => ({ steamId, names: [], hidden: false })) })}
                          className="text-[11px] text-fog-500 underline hover:text-fog-100"
                        >
                          desfazer
                        </button>
                      </div>
                    ) : (
                      <span className="text-fog-500">—</span>
                    )}
                  </Td>
                </tr>
              );
            })}
          </tbody>
        </Table>
        <ul className="mt-3 space-y-1 text-[11px] text-fog-500">
          <li>
            <strong className="font-medium text-fog-300">Esconder</strong> é reversível: os números
            continuam guardados no banco, só saem das páginas.
          </li>
          <li>
            <strong className="font-medium text-fog-300">Mesclar</strong> credita as partidas de
            todas as contas selecionadas ao jogador que você mantiver. Use só para contas da mesma
            pessoa — se duas contas mescladas tiverem jogado a mesma partida, as médias por round
            (ADR, KAST) ficam infladas, porque os rounds são os mesmos.
          </li>
        </ul>
      </Card>

      <Card>
        <SectionTitle
          title="Partidas"
          hint={`${matches.length} registros. Apagar remove as estatísticas dessa partida de vez.`}
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Data</Th>
              <Th align="left">Mapa</Th>
              <Th align="left">Adversário</Th>
              <Th>Placar</Th>
              <Th>Rounds</Th>
              <Th align="left">Arquivo</Th>
              <Th align="left">Enviado por</Th>
              <Th align="left">&nbsp;</Th>
            </tr>
          </thead>
          <tbody>
            {matches.map((match) => (
              <tr key={match.id}>
                <Td align="left" className="text-xs text-fog-500">
                  {dateLabel(match.playedAt)}
                  {!match.playedAtKnown ? (
                    <span title="A data veio do upload: o nome do arquivo não tinha a data da partida.">
                      {" "}
                      ~
                    </span>
                  ) : null}
                </Td>
                <Td align="left" className="font-medium">
                  <Link href={`/matches/${match.id}`} className="hover:text-win">
                    {mapLabel(match.map)}
                  </Link>
                </Td>
                <Td align="left" className="max-w-[160px] truncate text-xs text-fog-500">
                  {match.opponent || "—"}
                </Td>
                <Td>
                  <Pill
                    tone={
                      match.result === "win" ? "win" : match.result === "loss" ? "loss" : "neutral"
                    }
                  >
                    {match.ourScore}–{match.theirScore}
                  </Pill>
                </Td>
                <Td className="text-fog-500">{match.rounds}</Td>
                <Td align="left" className="max-w-[200px] truncate text-[11px] text-fog-500">
                  <span title={`${match.fileName} · enviado ${dateTimeLabel(match.uploadedAt)}`}>
                    {match.fileName} · {bytes(match.fileSizeBytes)}
                  </span>
                </Td>
                <Td align="left" className="text-xs text-fog-500">
                  {match.uploadedBy}
                </Td>
                <Td align="left">
                  <button
                    type="button"
                    onClick={() => removeMatch(match)}
                    disabled={removing === match.id}
                    className="rounded-md border border-loss/30 px-2 py-1 text-xs text-loss transition-colors hover:bg-loss/10 disabled:opacity-40"
                  >
                    {removing === match.id ? "Apagando…" : "Apagar"}
                  </button>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
}
