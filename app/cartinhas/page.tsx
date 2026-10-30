import Link from "next/link";
import { Card, Empty, SectionTitle } from "@/components/ui";
import { CARD_LAYOUTS, layoutOf } from "@/components/cards";
import { aggregatePlayers, viewsIn, type Period } from "@/lib/aggregate";
import { buildCard, type CardEdition, type CardFrame } from "@/lib/card";
import { loadDataset } from "@/lib/data";

export const dynamic = "force-dynamic";

const MIN_MATCHES = 10;
const MIN_RECENT = 3;
const MIN_DAY = 2;

const PERIODS: { key: Period; label: string; hint: string; min: number }[] = [
  {
    key: "geral",
    label: "Geral",
    hint: `Tudo o que já foi enviado, de quem tem ${MIN_MATCHES}+ partidas`,
    min: MIN_MATCHES,
  },
  {
    key: "semana",
    label: "Esta semana",
    hint: `De segunda-feira para cá, de quem jogou ${MIN_RECENT}+ partidas`,
    min: MIN_RECENT,
  },
  {
    key: "7dias",
    label: "Últimos 7 dias",
    hint: `Os sete dias que acabaram de passar, de quem jogou ${MIN_RECENT}+ partidas`,
    min: MIN_RECENT,
  },
  {
    key: "24h",
    label: "Últimas 24h",
    hint: `O que rolou de ontem para cá, de quem jogou ${MIN_DAY}+ partidas`,
    min: MIN_DAY,
  },
];

const RANKS: { edition: CardEdition; badge: string }[] = [
  { edition: "colorida", badge: "1º" },
  { edition: "ouro", badge: "2º" },
  { edition: "prata", badge: "3º" },
  { edition: "bronze", badge: "4º" },
];

const PERIOD_STYLE: Record<
  Period,
  { frame: CardFrame; base?: CardEdition; first?: { edition: CardEdition; badge: string } }
> = {
  geral: { frame: "podio", first: { edition: "mvp", badge: "MVP" } },
  semana: { frame: "tracejado", base: "semana" },
  "7dias": { frame: "duplo", base: "sete" },
  "24h": { frame: "tracejado", base: "dia" },
};

export default async function CartinhasPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string; periodo?: string }>;
}) {
  const { views, tracked, config, profiles } = await loadDataset();

  if (views.length === 0) {
    return (
      <Empty
        title="Nenhuma cartinha ainda"
        body="Envie a primeira demo e cada jogador ganha a sua."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const { layout, periodo } = await searchParams;
  const chosen = layoutOf(layout);
  const Design = chosen.render;
  const period = PERIODS.find((p) => p.key === periodo) ?? PERIODS[0];

  const scoped = viewsIn(views, period.key);
  const everyone = aggregatePlayers(scoped, { tracked, onlyOurTeam: true });
  const regulars = everyone.filter((p) => p.matches >= period.min);
  const players = period.key === "geral" && regulars.length === 0 ? everyone : regulars;
  const style = PERIOD_STYLE[period.key];
  const rankAt = (index: number) => (index === 0 && style.first ? style.first : RANKS[index]);
  const cards = players.map((player, index) => {
    const rank = rankAt(index);
    return buildCard(player, scoped, {
      club: config.teamName,
      avatar: profiles[player.steamId]?.avatar,
      edition: rank?.edition ?? style.base,
      frame: rank ? style.frame : undefined,
      badge: rank?.badge,
    });
  });
  const href = (layoutKey: string, periodKey: string) =>
    `/cartinhas?layout=${layoutKey}&periodo=${periodKey}`;


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cartinhas</h1>
        <p className="mt-1 text-sm text-fog-500">
          Do melhor rating para o pior. No geral entra quem tem {MIN_MATCHES} partidas ou mais;
          nos recortes de semana, quem jogou pelo menos {MIN_RECENT}; nas últimas 24h, pelo menos{" "}
          {MIN_DAY}. As quatro primeiras levam moldura de pódio — branca de MVP no geral, colorida nos recortes de semana, depois ouro,
          prata e bronze — e o escudo muda de formato conforme o período.
        </p>
      </div>

      <Card>
        <SectionTitle title="Período" hint={period.hint} />
        <div className="flex flex-wrap gap-2">
          {PERIODS.map((option) => (
            <Link
              key={option.key}
              href={href(chosen.key, option.key)}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                option.key === period.key
                  ? "bg-ink-700 text-fog-100"
                  : "text-fog-500 hover:bg-ink-800 hover:text-fog-100"
              }`}
            >
              {option.label}
            </Link>
          ))}
        </div>

        <div className="mt-5">
          <SectionTitle title="Desenho" hint="Vale para todas as cartinhas desta página" />
          <div className="flex flex-wrap gap-2">
            {CARD_LAYOUTS.map((option) => (
              <Link
                key={option.key}
                href={href(option.key, period.key)}
                className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                  option.key === chosen.key
                    ? "bg-ink-700 text-fog-100"
                    : "text-fog-500 hover:bg-ink-800 hover:text-fog-100"
                }`}
              >
                {option.key}. {option.title}
              </Link>
            ))}
          </div>
        </div>
      </Card>

      {cards.length === 0 ? (
        <Empty
          title={`Ninguém fechou ${period.min} partidas neste período`}
          body="Troque o período para ver as cartinhas de sempre."
          cta={{ href: "/cartinhas", label: "Ver o geral" }}
        />
      ) : (
        <div className="flex flex-wrap justify-center gap-6">
          {cards.map((card, index) => (
            <Link
              key={card.steamId}
              href={`/players/${card.steamId}/cartinha?layout=${chosen.key}`}
              className="flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"
            >
              <Design card={card} scale={0.42} />
              <span className="text-xs text-fog-500">
                {index + 1}º · rating {players[index].rating.toFixed(2)} ·{" "}
                {players[index].matches} partida{players[index].matches === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
