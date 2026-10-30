import type { ReactElement } from "react";
import type { PlayerCard } from "@/lib/card";
import { FifaCard } from "@/components/fifa-card";
import {
  CardBarras,
  CardFaixa,
  CardFaixaLateral,
  CardMapaAberto,
  CardMedalhao,
  CardPlacar,
  CardPoster,
  CardRadar,
  CardTipografico,
} from "@/components/fifa-card-layouts";

export interface CardLayoutOption {
  key: string;
  title: string;
  hint: string;
  render: (props: { card: PlayerCard; scale?: number }) => ReactElement;
}

export const CARD_LAYOUTS: CardLayoutOption[] = [
  {
    key: "1",
    title: "Clássico",
    hint: "Foto quadrada à direita, overall e mapa à esquerda, notas em duas colunas",
    render: FifaCard,
  },
  {
    key: "2",
    title: "Medalhão",
    hint: "Foto redonda, mapa e time em etiquetas, nome numa faixa",
    render: CardMedalhao,
  },
  {
    key: "3",
    title: "Barras",
    hint: "Cabeçalho com foto e overall, as seis notas em barras",
    render: CardBarras,
  },
  {
    key: "4",
    title: "Radar",
    hint: "As seis notas num hexágono, como o gráfico de atributos",
    render: CardRadar,
  },
  {
    key: "5",
    title: "Faixa lateral",
    hint: "Coluna colorida com o overall e o resto alinhado à direita",
    render: CardFaixaLateral,
  },
  {
    key: "6",
    title: "Tipográfico",
    hint: "Sem foto: overall gigante e as notas numa linha só",
    render: CardTipografico,
  },
  {
    key: "7",
    title: "Placar",
    hint: "Notas em linhas listradas, como um placar de partida",
    render: CardPlacar,
  },
  {
    key: "8",
    title: "Faixa",
    hint: "Nome numa tarja sólida e as notas em seis caixas",
    render: CardFaixa,
  },
  {
    key: "9",
    title: "Mapa aberto",
    hint: "O radar do mapa quase inteiro, com o texto só embaixo",
    render: CardMapaAberto,
  },
  {
    key: "10",
    title: "Pôster",
    hint: "Foto grande no centro com o overall num selo",
    render: CardPoster,
  },
];

export function layoutOf(value: string | undefined | null): CardLayoutOption {
  return CARD_LAYOUTS.find((option) => option.key === value) ?? CARD_LAYOUTS[0];
}
