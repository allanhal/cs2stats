import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { CARD_HEIGHT, CARD_WIDTH } from "@/components/fifa-card";
import { layoutOf } from "@/components/cards";
import { aggregatePlayers } from "@/lib/aggregate";
import { buildCard, type CardEdition } from "@/lib/card";
import { loadDataset } from "@/lib/data";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const anton = await readFile(join(process.cwd(), "public", "anton.ttf"));

const FORMATS: Record<string, { width: number; height: number }> = {
  feed: { width: 1080, height: 1350 },
  quadrado: { width: 1080, height: 1080 },
  story: { width: 1080, height: 1920 },
};

async function inlineImage(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    if (url.startsWith("/")) {
      const file = await readFile(join(process.cwd(), "public", url.slice(1)));
      const extension = url.slice(url.lastIndexOf(".") + 1).toLowerCase();
      const localType = extension === "svg" ? "image/svg+xml" : `image/${extension}`;
      return `data:${localType};base64,${file.toString("base64")}`;
    }
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/svg+xml";
    const body = Buffer.from(await response.arrayBuffer()).toString("base64");
    return `data:${type};base64,${body}`;
  } catch {
    return null;
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;
  const search = new URL(request.url).searchParams;
  const size = FORMATS[search.get("formato") ?? "feed"] ?? FORMATS.feed;
  const Layout = layoutOf(search.get("layout")).render;
  const asked = search.get("edicao");
  const edition = (
    ["colorida", "ouro", "prata", "bronze", "mvp", "semana", "sete"] as const
  ).find((key) => key === asked) as
    | CardEdition
    | undefined;

  const { views, config, profiles } = await loadDataset();
  const [player] = aggregatePlayers(views).filter((p) => p.steamId === steamId);
  if (!player) return new Response("Jogador não encontrado", { status: 404 });

  const card = buildCard(player, views, {
    club: config.teamName,
    avatar: profiles[steamId]?.avatar,
    edition,
  });
  const [mapImage, avatar] = await Promise.all([
    inlineImage(card.mapImage),
    inlineImage(card.avatar || null),
  ]);

  const scale = Math.min(1, (size.height - 240) / CARD_HEIGHT, (size.width - 96) / CARD_WIDTH);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: size.width,
          height: size.height,
          backgroundColor: "#08090c",
          fontFamily: "Anton",
        }}
      >
        <div
          style={{
            display: "flex",
            marginBottom: 28,
            fontSize: 34,
            letterSpacing: 6,
            color: "#8b93a7",
          }}
        >
          {card.club.toUpperCase()}
        </div>
        <Layout card={{ ...card, mapImage, avatar: avatar ?? "" }} scale={scale} />
        <div
          style={{
            display: "flex",
            marginTop: 28,
            fontSize: 28,
            letterSpacing: 4,
            color: "#8b93a7",
          }}
        >
          CS2 STATS
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [{ name: "Anton", data: anton, weight: 400, style: "normal" }],
    },
  );
}
