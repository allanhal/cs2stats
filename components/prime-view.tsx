import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, MapTag, SectionTitle, Table, Td, Th } from "@/components/ui";
import { CARD_LAYOUTS, layoutOf } from "@/components/cards";
import { ShareCard } from "@/components/share-card";
import { LocalTime } from "@/components/local-time";
import { aggregatePlayers } from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { PRIME_MIN_ROUNDS, buildPrimeCard, primeMatches } from "@/lib/prime";

const FORMATS = [
  { key: "feed", label: "Feed 4:5", size: "1080 × 1350" },
  { key: "quadrado", label: "Quadrado", size: "1080 × 1080" },
  { key: "story", label: "Story", size: "1080 × 1920" },
];

export async function PrimeView({
  steamId,
  layout,
  formato,
}: {
  steamId: string;
  layout?: string;
  formato?: string;
}) {
  const format = FORMATS.find((f) => f.key === formato) ?? FORMATS[0];
  const chosen = layoutOf(layout);
  const Preview = chosen.render;

  const { views, config, profiles } = await loadDataset();
  const [player] = aggregatePlayers(views).filter((p) => p.steamId === steamId);
  if (!player) notFound();

  const played = primeMatches(views).get(steamId) ?? [];
  const card = buildPrimeCard(player, played, {
    club: config.teamName,
    avatar: profiles[steamId]?.avatar,
  });
  if (!card) notFound();

  const pageUrl = (key: string, formatKey: string) =>
    `/players/${steamId}/prime?layout=${key}&formato=${formatKey}`;
  const imageUrl = `/players/${steamId}/prime/image?formato=${format.key}&layout=${chosen.key}`;

  return (
    <div className="space-y-7">
      <div>
        <Link href={`/players/${steamId}`} className="text-xs text-fog-500 hover:text-fog-100">
          ← voltar para {player.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">O prime de {player.name}</h1>
        <p className="mt-1 text-sm text-fog-500">
          Nada de média: cada nota desta cartinha é a maior que {player.name} já alcançou numa
          partida, e cada uma pode ter saído de um dia diferente. Entram as{" "}
          {card.considered} partidas com {PRIME_MIN_ROUNDS} rounds ou mais.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex justify-center">
          <Preview card={card} scale={0.62} />
        </div>

        <div className="space-y-5">
          <Card>
            <SectionTitle
              title="O pico"
              hint={`Overall ${card.overall} vem do rating ${card.peakRating.toFixed(2)}, a melhor partida da vida dele`}
            />
            <div className="flex flex-wrap items-center gap-2 text-sm text-fog-300">
              <MapTag map={card.map} />
              <LocalTime iso={card.peakDate} />
              <Link
                href={`/matches/${card.peakMatchId}`}
                className="text-xs text-fog-500 underline decoration-ink-700 underline-offset-2 transition-colors hover:text-fog-100"
              >
                ver a partida →
              </Link>
            </div>
            <p className="mt-3 text-[11px] text-fog-500">
              O K/D {card.kd.toFixed(2)} e o ADR {card.adr.toFixed(0)} embaixo do nome também são
              recordes, e podem ser de outras partidas.
            </p>
          </Card>

          <Card>
            <SectionTitle title={chosen.title} hint={chosen.hint} />
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <Link
                  key={f.key}
                  href={pageUrl(chosen.key, f.key)}
                  className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                    f.key === format.key
                      ? "bg-ink-700 text-fog-100"
                      : "text-fog-500 hover:bg-ink-800 hover:text-fog-100"
                  }`}
                >
                  {f.label}
                  <span className="ml-2 text-[11px] text-fog-500">{f.size}</span>
                </Link>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <ShareCard url={imageUrl} fileName={`${player.name}-prime-${format.key}.png`} />
              <a
                href={imageUrl}
                download={`${player.name}-prime-${format.key}.png`}
                className="rounded-md border border-ink-700 px-3.5 py-2 text-sm text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
              >
                Baixar PNG
              </a>
              <Link
                href={`/players/${steamId}/cartinha`}
                className="rounded-md px-3 py-2 text-sm text-fog-500 transition-colors hover:text-fog-100"
              >
                Ver a cartinha de carreira
              </Link>
            </div>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle
          title="De onde saiu cada nota"
          hint="A partida que fixou o recorde de cada atributo"
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Atributo</Th>
              <Th>Nota</Th>
              <Th align="left">Mapa</Th>
              <Th align="left">Quando</Th>
              <Th align="left">O que conta</Th>
            </tr>
          </thead>
          <tbody>
            {card.stats.map((stat) => (
              <tr key={stat.key}>
                <Td align="left">
                  <span className="font-medium">{stat.key}</span>
                  <span className="ml-2 text-fog-500">{stat.label}</span>
                </Td>
                <Td>{stat.value}</Td>
                <Td align="left">
                  <MapTag map={stat.map} />
                </Td>
                <Td align="left">
                  <Link
                    href={`/matches/${stat.matchId}`}
                    className="transition-colors hover:text-fog-100"
                  >
                    <LocalTime iso={stat.date} />
                  </Link>
                </Td>
                <Td align="left" className="whitespace-normal text-[11px] text-fog-500">
                  {stat.hint}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <SectionTitle
          title="Os recordes soltos"
          hint="O maior número que ele já colocou em cada conta, numa partida só"
        />
        <Table>
          <thead>
            <tr>
              <Th align="left">Recorde</Th>
              <Th>Marca</Th>
              <Th align="left">Mapa</Th>
              <Th align="left">Quando</Th>
            </tr>
          </thead>
          <tbody>
            {card.marks.map((mark) => (
              <tr key={mark.label}>
                <Td align="left">{mark.label}</Td>
                <Td>{mark.value}</Td>
                <Td align="left">
                  <MapTag map={mark.map} />
                </Td>
                <Td align="left">
                  <Link
                    href={`/matches/${mark.matchId}`}
                    className="transition-colors hover:text-fog-100"
                  >
                    <LocalTime iso={mark.date} />
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>

      <Card>
        <SectionTitle
          title="Escolha o desenho"
          hint="Os dez layouts com as máximas deste jogador — clique para trocar"
        />
        <div className="flex flex-wrap justify-center gap-5">
          {CARD_LAYOUTS.map((option) => {
            const Thumb = option.render;
            const active = option.key === chosen.key;
            return (
              <Link
                key={option.key}
                href={pageUrl(option.key, format.key)}
                className={`flex flex-col items-center gap-2 rounded-lg border p-2 transition-colors ${
                  active
                    ? "border-win/60 bg-ink-800"
                    : "border-transparent hover:border-ink-700 hover:bg-ink-900"
                }`}
              >
                <Thumb card={card} scale={0.26} />
                <span className={`text-xs ${active ? "text-fog-100" : "text-fog-500"}`}>
                  {option.key}. {option.title}
                </span>
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
