import Link from "next/link";
import { Card, Empty, SectionTitle } from "@/components/ui";
import { CARD_LAYOUTS, layoutOf } from "@/components/cards";
import { loadDataset } from "@/lib/data";
import { PRIME_MIN_ROUNDS, primeCards } from "@/lib/prime";

export const dynamic = "force-dynamic";

export default async function PrimeCartinhasPage({
  searchParams,
}: {
  searchParams: Promise<{ layout?: string }>;
}) {
  const { views, tracked, config, profiles } = await loadDataset();

  if (views.length === 0) {
    return (
      <Empty
        title="Nenhum prime ainda"
        body="Envie a primeira demo e cada jogador ganha a cartinha do seu melhor dia."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const { layout } = await searchParams;
  const chosen = layoutOf(layout);
  const Design = chosen.render;

  const avatars: Record<string, string | undefined> = {};
  for (const [steamId, profile] of Object.entries(profiles)) avatars[steamId] = profile.avatar;

  const cards = primeCards(views, tracked, { club: config.teamName, avatars });

  return (
    <div className="space-y-6">
      <div>
        <Link href="/cartinhas" className="text-xs text-fog-500 hover:text-fog-100">
          ← voltar para as cartinhas
        </Link>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">O prime de cada um</h1>
        <p className="mt-1 text-sm text-fog-500">
          Uma cartinha por jogador, feita só de máximas: cada nota é a maior que ele já alcançou
          numa partida, e cada uma pode ter saído de um dia diferente. O overall vem da melhor
          partida da vida dele. Contam as partidas com {PRIME_MIN_ROUNDS} rounds ou mais.
        </p>
      </div>

      <Card>
        <SectionTitle title="Desenho" hint="Vale para todas as cartinhas desta página" />
        <div className="flex flex-wrap gap-2">
          {CARD_LAYOUTS.map((option) => (
            <Link
              key={option.key}
              href={`/cartinhas/prime?layout=${option.key}`}
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
      </Card>

      {cards.length === 0 ? (
        <Empty
          title="Ninguém jogou o suficiente"
          body="Nenhuma partida fechou rounds bastantes para virar recorde."
          cta={{ href: "/cartinhas", label: "Ver as cartinhas de carreira" }}
        />
      ) : (
        <div className="flex flex-wrap justify-center gap-6">
          {cards.map((card) => (
            <Link
              key={card.steamId}
              href={`/players/${card.steamId}/prime?layout=${chosen.key}`}
              className="flex flex-col items-center gap-2 transition-transform hover:-translate-y-1"
            >
              <Design card={card} scale={0.42} />
              <span className="text-xs text-fog-500">
                pico de rating {card.peakRating.toFixed(2)} em {card.mapName} ·{" "}
                {card.considered} partida{card.considered === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
