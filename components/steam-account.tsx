"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui";

export function SteamAccount({
  persona,
  avatar,
  steamId,
}: {
  persona: string;
  avatar: string;
  steamId: string;
}) {
  const router = useRouter();

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <Card>
        <div className="flex items-center gap-3">
          {avatar ? (
            <img src={avatar} alt="" className="size-11 rounded-lg" />
          ) : (
            <div className="grid size-11 place-items-center rounded-lg bg-ink-800 text-sm text-fog-500">
              CS
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{persona || "Jogador"}</div>
            <div className="tnum truncate text-xs text-fog-500">{steamId}</div>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-4">
          <Link
            href={`/players/${steamId}`}
            className="text-xs text-fog-300 transition-colors hover:text-fog-100"
          >
            Ver minhas estatísticas
          </Link>
          <button
            onClick={logout}
            className="text-xs text-fog-500 transition-colors hover:text-fog-100"
          >
            Sair
          </button>
        </div>
      </Card>

      <Card>
        <p className="text-sm text-fog-500">
          O login serve para o site saber quem é você e ligar seu perfil às partidas. Para mandar
          partidas novas, use o script do PowerShell em{" "}
          <Link href="/upload" className="text-fog-100 underline underline-offset-2">
            Enviar demo
          </Link>
          : ele lê as demos no seu PC e manda só as estatísticas. Soltar o arquivo `.dem` na
          mesma página continua funcionando como alternativa.
        </p>
      </Card>
    </div>
  );
}
