import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, SectionTitle } from "@/components/ui";
import { CARD_LAYOUTS, layoutOf } from "@/components/cards";
import { ShareCard } from "@/components/share-card";
import { aggregatePlayers } from "@/lib/aggregate";
import { buildCard } from "@/lib/card";
import { loadDataset } from "@/lib/data";

const FORMATS = [
  { key: "feed", label: "Feed 4:5", size: "1080 × 1350" },
  { key: "quadrado", label: "Quadrado", size: "1080 × 1080" },
  { key: "story", label: "Story", size: "1080 × 1920" },
];

const POSITIONS = [
  { key: "ENT", label: "Entry fragger", hint: "É quem abre o round e troca o primeiro tiro" },
  { key: "AWP", label: "Sniper", hint: "Boa parte das kills dele sai de AWP ou Scout" },
  { key: "SUP", label: "Suporte", hint: "Joga de granada: dano de utilitário e flash assist" },
  { key: "ANC", label: "Âncora", hint: "Segura o bomb e sobrevive mais que os outros" },
  { key: "RIF", label: "Rifler", hint: "O padrão: rifle na mão, sem função marcada" },
];

const LEGEND = [
  { key: "CON", label: "Consistência", hint: "KAST e rounds em que ele fez alguma coisa" },
  { key: "PST", label: "Pistol round", hint: "Vitórias e kills nos rounds de pistola" },
  { key: "CLT", label: "Clutch", hint: "Clutches fechados e rounds com 3+ kills" },
  { key: "RIF", label: "Rifle", hint: "Kills de rifle por round e headshots" },
  { key: "IMP", label: "Impacto", hint: "Kills e assistências que decidem o round" },
  { key: "AWP", label: "Sniper", hint: "Kills de AWP e aberturas com a sniper" },
];

export async function CartinhaView({
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

  const card = buildCard(player, views, {
    club: config.teamName,
    avatar: profiles[steamId]?.avatar,
  });
  const pageUrl = (key: string, formatKey: string) =>
    `/players/${steamId}/cartinha?layout=${key}&formato=${formatKey}`;
  const imageUrl = `/players/${steamId}/cartinha/image?formato=${format.key}&layout=${chosen.key}`;

  return (
    <div className="space-y-7">
      <div>
        <Link href={`/players/${steamId}`} className="text-xs text-fog-500 hover:text-fog-100">
          ← voltar para {player.name}
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight">Cartinha de {player.name}</h1>
        <p className="mt-1 text-sm text-fog-500">
          Dez desenhos com os mesmos números. Escolha um, pegue o tamanho do Instagram e poste.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
        <div className="flex justify-center">
          <Preview card={card} scale={0.62} />
        </div>

        <div className="space-y-5">
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
              <ShareCard url={imageUrl} fileName={`${player.name}-${format.key}.png`} />
              <a
                href={imageUrl}
                download={`${player.name}-${format.key}.png`}
                className="rounded-md border border-ink-700 px-3.5 py-2 text-sm text-fog-300 transition-colors hover:bg-ink-800 hover:text-fog-100"
              >
                Baixar PNG
              </a>
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-md px-3 py-2 text-sm text-fog-500 transition-colors hover:text-fog-100"
              >
                Abrir imagem
              </a>
            </div>
          </Card>

          <Card>
            <SectionTitle title="O que cada sigla quer dizer" />
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {LEGEND.map((item) => (
                <div key={item.key} className="border-b border-ink-700/40 pb-2">
                  <dt className="text-sm font-medium">
                    {item.key}
                    <span className="ml-2 text-fog-500">{item.label}</span>
                  </dt>
                  <dd className="mt-0.5 text-[11px] text-fog-500">{item.hint}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-[11px] text-fog-500">
              Overall {card.overall} vem do rating {player.rating.toFixed(2)} em {player.matches}{" "}
              partidas.
            </p>
          </Card>

          <Card>
            <SectionTitle
              title="A posição embaixo do overall"
              hint={`${card.role} é a função que os números apontam para ${player.name}`}
            />
            <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
              {POSITIONS.map((item) => (
                <div
                  key={item.key}
                  className={`border-b pb-2 ${
                    item.key === card.role ? "border-win/50" : "border-ink-700/40"
                  }`}
                >
                  <dt className="text-sm font-medium">
                    <span className={item.key === card.role ? "text-win" : ""}>{item.key}</span>
                    <span className="ml-2 text-fog-500">{item.label}</span>
                  </dt>
                  <dd className="mt-0.5 text-[11px] text-fog-500">{item.hint}</dd>
                </div>
              ))}
            </dl>
          </Card>
        </div>
      </div>

      <Card>
        <SectionTitle
          title="Escolha o desenho"
          hint="Os dez layouts com os números deste jogador — clique para trocar"
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
