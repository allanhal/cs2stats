import { Card, SectionTitle } from "@/components/ui";
import { SteamAccount } from "@/components/steam-account";
import { currentUser } from "@/lib/account";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: PageProps<"/conta">) {
  const user = await currentUser();
  const failed = (await searchParams).erro === "login";

  if (!user) {
    return (
      <div className="mx-auto max-w-sm">
        <Card>
          <SectionTitle
            title="Sua conta"
            hint="Entre com a Steam para o site reconhecer você e ligar seu perfil às partidas"
          />
          {failed ? (
            <p className="mb-3 text-xs text-loss">A Steam não confirmou o login. Tente de novo.</p>
          ) : null}
          <a
            href="/api/auth/steam"
            className="block rounded-lg bg-win px-3.5 py-2 text-center text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            Entrar pela Steam
          </a>
          <p className="mt-3 text-[11px] leading-relaxed text-fog-500">
            O login é feito na própria Steam: o site nunca vê sua senha, só recebe a confirmação de
            quem é você.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <SteamAccount persona={user.persona} avatar={user.avatar} steamId={user.steamId} />
  );
}
