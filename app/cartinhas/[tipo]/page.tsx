import Link from "next/link";
import { notFound } from "next/navigation";
import { Empty } from "@/components/ui";
import { ShareCard } from "@/components/share-card";
import { CartinhaDestaque } from "@/components/cartinha-destaque";
import { BOSTA_PERIODS, HERO_TONES, bostaPeriodOf, buildHeroCard, heroToneOf } from "@/lib/bosta";
import { loadDataset } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DestaquePage({
  params,
  searchParams,
}: {
  params: Promise<{ tipo: string }>;
  searchParams: Promise<{ periodo?: string }>;
}) {
  const { tipo } = await params;
  const tone = heroToneOf(tipo);
  if (!tone) notFound();

  const { periodo } = await searchParams;
  const period = bostaPeriodOf(periodo);
  const { views, tracked, config, profiles } = await loadDataset();
  const card = buildHeroCard(views, tracked, {
    club: config.teamName,
    profiles,
    period: period.key,
    tone,
  });

  const heading = HERO_TONES.find((t) => t.key === tone)?.heading ?? "";

  if (!card) {
    return (
      <Empty
        title="Ainda não dá pra eleger ninguém"
        body={`Ninguém fechou ${period.min} partidas em ${period.label.toLowerCase()}.`}
        cta={{ href: `/cartinhas/${tone}`, label: "Ver o geral" }}
      />
    );
  }

  return (
    <div className="space-y-7">
      <div>
        <Link href="/cartinhas" className="text-xs text-fog-500 hover:text-fog-100">
          ← voltar para as cartinhas
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">{heading}</h1>
        <p className="mt-1 text-sm text-fog-500">
          {tone === "pior"
            ? "Quem some nas três contas ao mesmo tempo: menor KAST, menos kills por round e o maior estrago no aproveitamento do lobby."
            : "Quem aparece nas três contas ao mesmo tempo: maior KAST, mais kills por round e o maior ganho no aproveitamento do lobby."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {HERO_TONES.map((option) => (
          <Link
            key={option.key}
            href={`/cartinhas/${option.key}?periodo=${period.key}`}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              option.key === tone
                ? "bg-ink-700 text-fog-100"
                : "text-fog-500 hover:bg-ink-800 hover:text-fog-100"
            }`}
          >
            {option.label}
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {BOSTA_PERIODS.map((option) => (
          <Link
            key={option.key}
            href={`/cartinhas/${tone}?periodo=${option.key}`}
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

      <div className="flex flex-col items-start gap-4">
        <CartinhaDestaque card={card} scale={0.62} />
        <ShareCard
          url={`/cartinhas/${tone}/image?periodo=${period.key}`}
          fileName={`${tone}-jogador.png`}
        />
      </div>
    </div>
  );
}
