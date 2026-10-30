import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import {
  HERO_HEIGHT,
  HERO_WIDTH,
  CartinhaDestaque,
  heroBackdrop,
} from "@/components/cartinha-destaque";
import { bostaPeriodOf, buildHeroCard, heroToneOf } from "@/lib/bosta";
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
    const response = await fetch(url);
    if (!response.ok) return null;
    const type = response.headers.get("content-type") ?? "image/jpeg";
    return `data:${type};base64,${Buffer.from(await response.arrayBuffer()).toString("base64")}`;
  } catch {
    return null;
  }
}

export async function GET(request: Request, { params }: { params: Promise<{ tipo: string }> }) {
  const { tipo } = await params;
  const tone = heroToneOf(tipo);
  if (!tone) return new Response("Cartinha não encontrada", { status: 404 });

  const search = new URL(request.url).searchParams;
  const size = FORMATS[search.get("formato") ?? "feed"] ?? FORMATS.feed;

  const { views, tracked, config, profiles } = await loadDataset();
  const card = buildHeroCard(views, tracked, {
    club: config.teamName,
    profiles,
    period: bostaPeriodOf(search.get("periodo")).key,
    tone,
  });
  if (!card) return new Response("Sem jogadores suficientes", { status: 404 });

  const avatar = await inlineImage(card.avatar || null);
  const scale = Math.min(1, (size.height - 200) / HERO_HEIGHT, (size.width - 96) / HERO_WIDTH);

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
          backgroundColor: heroBackdrop(tone),
          fontFamily: "Anton",
        }}
      >
        <CartinhaDestaque card={{ ...card, avatar: avatar ?? "" }} scale={scale} />
        <div
          style={{
            display: "flex",
            marginTop: 26,
            fontSize: 26,
            letterSpacing: 4,
            color: tone === "pior" ? "#8a5f28" : "#2f7f52",
          }}
        >
          CS2 STATS
        </div>
      </div>
    ),
    {
      width: size.width,
      height: size.height,
      fonts: [{ name: "Anton", data: anton, style: "normal", weight: 400 }],
    },
  );
}
