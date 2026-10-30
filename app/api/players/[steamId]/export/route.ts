import { loadDataset } from "@/lib/data";
import { EXPORT_VERSION, buildPlayerExport } from "@/lib/player-export";
import { dataRevision } from "@/lib/store";

export const runtime = "nodejs";

const STEAM_ID = /^\d{5,20}$/;

let cached: { key: string; body: string; fileName: string } | null = null;

function slug(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "jogador"
  );
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ steamId: string }> },
) {
  const { steamId } = await params;
  if (!STEAM_ID.test(steamId)) {
    return Response.json({ error: "SteamID inválido" }, { status: 400 });
  }

  const revision = await dataRevision();
  const key = `${steamId}|${revision}|${EXPORT_VERSION}`;
  const etag = `"cs2stats-${key}"`;

  if (request.headers.get("if-none-match") === etag) {
    return new Response(null, { status: 304, headers: { ETag: etag } });
  }

  if (!cached || cached.key !== key) {
    const dataset = await loadDataset();
    const data = buildPlayerExport(steamId, dataset);
    if (!data) {
      return Response.json({ error: "Jogador não encontrado" }, { status: 404 });
    }
    cached = {
      key,
      body: JSON.stringify(data),
      fileName: `cs2stats-${slug(data.player.name)}-${steamId}.json`,
    };
  }

  return new Response(cached.body, {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${cached.fileName}"`,
      "Cache-Control": "private, max-age=0, must-revalidate",
      ETag: etag,
    },
  });
}
