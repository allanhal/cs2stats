"use client";

import { upload } from "@vercel/blob/client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Card, Pill, SectionTitle } from "@/components/ui";
import { fingerprintFile } from "@/lib/demo-hash";
import { bytes, mapLabel } from "@/lib/format";
import {
  UploadFailure,
  createUploadQueue,
  type QueueItem,
  type QueueStatus,
  type UploadResult,
} from "@/lib/upload-queue";

const WINDOWS_COMMAND =
  'irm https://cs2.allanpinheiro.com/cs2stats.ps1 -OutFile "$env:TEMP\\cs2stats.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\\cs2stats.ps1"';

function CopyLine({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-3 flex items-stretch gap-2">
      <code className="flex-1 overflow-x-auto whitespace-nowrap rounded-lg border border-ink-700 bg-ink-850 px-3 py-2.5 font-mono text-xs text-fog-300">
        {text}
      </code>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-ink-700 px-3 text-xs font-semibold text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
      >
        {copied ? "copiado" : "copiar"}
      </button>
    </div>
  );
}

const STATUS_LABEL: Record<QueueStatus, string> = {
  pending: "na fila",
  uploading: "enviando",
  parsing: "processando",
  done: "pronto",
  error: "falhou",
};

export default function UploadPage() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [nick, setNick] = useState("");
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const [queue] = useState(() =>
    createUploadQueue({
      onChange: setItems,
      send: async (file, hooks, by) => {
        const hash = await fingerprintFile(file);
        const known = (await fetch("/api/upload/check", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ hash, name: file.name, size: file.size }),
        })
          .then((r) => r.json())
          .catch(() => ({}))) as { known?: boolean; matchId?: string };

        if (known.known) {
          throw new UploadFailure("Essa demo já está no site", {
            matchId: known.matchId,
            duplicate: true,
          });
        }

        const blob = await upload(`incoming/${file.name}`, file, {
          access: "private",
          handleUploadUrl: "/api/upload/token",
          contentType: "application/octet-stream",
          multipart: true,
          onUploadProgress: ({ percentage }) =>
            hooks.onProgress(percentage / 100),
        });

        hooks.onParsing();

        let response: Response;
        let payload: Partial<UploadResult> & { error?: string; duplicate?: boolean };
        for (let attempt = 0; ; attempt++) {
          response = await fetch("/api/upload/ingest", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              pathname: blob.pathname,
              name: file.name,
              by: by.trim(),
            }),
          });
          payload = (await response.json()) as typeof payload;
          if (response.status !== 429 || attempt >= 40) break;
          await new Promise((resolve) => setTimeout(resolve, 15_000));
        }
        if (!response.ok) {
          throw new UploadFailure(
            payload.error ?? "Não foi possível processar a demo",
            {
              matchId: payload.matchId,
              duplicate: payload.duplicate,
            },
          );
        }
        return payload as UploadResult;
      },
    }),
  );

  const busy = items.some(
    (i) => i.status === "uploading" || i.status === "parsing",
  );
  const pending = items.filter((i) => i.status === "pending").length;
  const finished = items.filter((i) => i.status === "done").length;
  const failed = items.filter((i) => i.status === "error").length;

  useEffect(() => {
    if (!busy && pending === 0) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [busy, pending]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enviar demos</h1>
        <p className="mt-1.5 text-sm text-fog-500">
          Selecione quantos arquivos{" "}
          <code className="font-mono text-fog-300">.dem</code> quiser, ou solte
          a pasta inteira aqui. Eles entram numa fila e são processados um por
          vez, sem você precisar fazer mais nada. As estatísticas ficam salvas e
          cada demo é descartada depois de lida.
        </p>
      </div>

      <Card>
        <SectionTitle
          title="Quem está enviando"
          hint="Aparece na lista de partidas. Opcional."
        />
        <input
          value={nick}
          onChange={(e) => setNick(e.target.value)}
          placeholder="seu nick"
          maxLength={60}
          className="w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm outline-none placeholder:text-fog-500 focus:border-win/60"
        />
      </Card>

      <Card>
        <SectionTitle
          title="Enviar tudo de uma vez, no Windows"
          hint="Lê as demos no seu PC e manda só os números"
        />
        <p className="text-sm text-fog-500">
          Primeiro, no CS2: <strong className="text-fog-300">Jogar → Suas
          partidas</strong> e <strong className="text-fog-300">Baixar</strong>{" "}
          em cada partida. Depois abra o PowerShell e cole a linha abaixo. Ele
          acha as demos sozinho e lê cada uma aqui no seu computador: para o
          site vão apenas as estatísticas, cerca de 15 KB por partida, nunca a
          demo. Não precisa instalar nada antes.
        </p>
        <CopyLine text={WINDOWS_COMMAND} />
        <p className="mt-2 text-xs text-fog-500">
          Para ver o que ele faria sem enviar nada, acrescente{" "}
          <code className="font-mono text-fog-300">-WhatIfOnly</code>.
        </p>
      </Card>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0)
            queue.add(e.dataTransfer.files, nick);
        }}
        className={`rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
          dragging ? "border-win bg-win/5" : "border-ink-700 bg-ink-900/50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".dem,.zst,.bz2"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) queue.add(e.target.files, nick);
            e.target.value = "";
          }}
        />
        <p className="text-sm text-fog-300">Solte os arquivos .dem, .dem.zst ou .dem.bz2 aqui</p>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="mt-3 rounded-lg bg-win px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
        >
          Escolher arquivos
        </button>
        {busy || pending > 0 ? (
          <p className="mt-3 text-xs text-fog-500">
            Pode adicionar mais enquanto a fila roda — vão para o fim dela.
          </p>
        ) : null}
      </div>

      {items.length > 0 ? (
        <Card>
          <SectionTitle
            title="Fila"
            hint={[
              `${finished} pronta${finished === 1 ? "" : "s"}`,
              busy ? "1 em andamento" : null,
              pending > 0 ? `${pending} esperando` : null,
              failed > 0 ? `${failed} com problema` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
            action={
              finished + failed > 0 ? (
                <button
                  type="button"
                  onClick={() => queue.clearFinished()}
                  className="text-xs text-fog-500 hover:text-fog-100"
                >
                  limpar concluídas
                </button>
              ) : null
            }
          />

          <ul className="divide-y divide-ink-700/50">
            {items.map((item) => (
              <li key={item.id} className="py-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span
                    className="min-w-0 flex-1 truncate text-sm"
                    title={item.name}
                  >
                    {item.name}
                  </span>
                  {item.size > 0 ? (
                    <span className="shrink-0 text-xs text-fog-500">
                      {bytes(item.size)}
                    </span>
                  ) : null}
                  <Pill
                    tone={
                      item.status === "done"
                        ? "win"
                        : item.status === "error"
                          ? "loss"
                          : "neutral"
                    }
                  >
                    {STATUS_LABEL[item.status]}
                  </Pill>
                </div>

                {item.status === "uploading" || item.status === "parsing" ? (
                  <div className="mt-1.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-ink-700">
                      <div
                        className={`h-full rounded-full bg-win transition-[width] duration-200 ${
                          item.status === "parsing" ? "animate-pulse" : ""
                        }`}
                        style={{
                          width: `${Math.max(item.progress, 0.02) * 100}%`,
                        }}
                      />
                    </div>
                    <p className="tnum mt-1 text-[11px] text-fog-500">
                      {item.status === "uploading"
                        ? `enviando… ${Math.round(item.progress * 100)}%`
                        : "extraindo as estatísticas…"}
                    </p>
                  </div>
                ) : null}

                {item.status === "done" && item.result ? (
                  <p className="mt-1 text-xs text-fog-500">
                    {mapLabel(item.result.map)}
                    {item.result.score
                      ? ` ${item.result.score.A}–${item.result.score.B}`
                      : null}{" "}
                    · {item.result.rounds} rounds · {item.result.players}{" "}
                    jogadores ·{" "}
                    <Link
                      href={`/matches/${item.result.matchId}`}
                      className="text-win hover:underline"
                    >
                      ver a partida
                    </Link>
                  </p>
                ) : null}

                {item.status === "error" ? (
                  <p className="mt-1 text-xs text-loss">
                    {item.message}
                    {item.duplicate && item.result?.matchId ? (
                      <>
                        {" · "}
                        <Link
                          href={`/matches/${item.result.matchId}`}
                          className="text-fog-300 hover:underline"
                        >
                          ver a que já existe
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>

          {finished > 0 && !busy && pending === 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Link
                href="/"
                className="rounded-lg bg-win px-3.5 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
              >
                Ver as estatísticas
              </Link>
              <Link
                href="/matches"
                className="rounded-lg border border-ink-700 px-3.5 py-2 text-sm transition-colors hover:bg-ink-800"
              >
                Todas as partidas
              </Link>
            </div>
          ) : null}
        </Card>
      ) : null}

      <Card>
        <SectionTitle title="Onde achar as demos" />
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-fog-500">
          <li>
            No CS2, abra{" "}
            <span className="text-fog-300">Jogar → Suas partidas</span> e clique
            em <span className="text-fog-300">Baixar</span> em cada partida.
          </li>
          <li>
            Os arquivos vão para{" "}
            <span className="font-mono text-xs text-fog-300">csgo/replays</span>.
            Demos de liga são baixadas pelo navegador e costumam cair em{" "}
            <span className="font-mono text-xs text-fog-300">Downloads</span>.
          </li>
          <li>
            Compactadas servem como estão:{" "}
            <span className="font-mono text-xs text-fog-300">.dem</span>,{" "}
            <span className="font-mono text-xs text-fog-300">.dem.zst</span> e{" "}
            <span className="font-mono text-xs text-fog-300">.dem.bz2</span> são
            descompactadas sozinhas.
          </li>
        </ol>
      </Card>
    </div>
  );
}
