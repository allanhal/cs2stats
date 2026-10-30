import { headers } from "next/headers";
import { Card, SectionTitle } from "@/components/ui";
import { originFromHeaders } from "@/lib/origin";
import { macCommand, windowsCommand } from "@/lib/site";
import { CopyLine } from "./copy-line";

export const dynamic = "force-dynamic";

export default async function UploadPage() {
  const origin = originFromHeaders(await headers());

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Enviar demos</h1>
        <p className="mt-1.5 text-sm text-fog-500">
          O envio é feito por um script que roda no seu computador: ele acha as demos sozinho, lê
          cada uma aí mesmo e manda só os números, cerca de 15 KB por partida. A demo nunca sobe.
        </p>
      </div>

      <Card>
        <SectionTitle
          title="No Windows"
          hint="Lê as demos no seu PC e manda só os números"
        />
        <p className="text-sm text-fog-500">
          Primeiro, no CS2: <strong className="text-fog-300">Jogar → Suas
          partidas</strong> e <strong className="text-fog-300">Baixar</strong>{" "}
          em cada partida. Depois abra o PowerShell e cole a linha abaixo. Não precisa instalar
          nada antes.
        </p>
        <CopyLine text={windowsCommand(origin)} />
        <p className="mt-2 text-xs text-fog-500">
          Para ver o que ele faria sem enviar nada, acrescente{" "}
          <code className="font-mono text-fog-300">-WhatIfOnly</code>.
        </p>
      </Card>

      <Card>
        <SectionTitle title="No Mac" hint="Lê as demos no seu Mac e manda só os números" />
        <p className="text-sm text-fog-500">
          Primeiro, no CS2: <strong className="text-fog-300">Jogar → Suas
          partidas</strong> e <strong className="text-fog-300">Baixar</strong>{" "}
          em cada partida. Depois abra o Terminal e cole a linha abaixo. Não precisa instalar nada
          antes.
        </p>
        <CopyLine text={macCommand(origin)} />
        <p className="mt-2 text-xs text-fog-500">
          Para ver o que ele faria sem enviar nada, acrescente{" "}
          <code className="font-mono text-fog-300">--what-if</code>.
        </p>
      </Card>

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
