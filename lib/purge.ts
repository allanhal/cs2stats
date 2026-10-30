import { requireEnv } from "./env";

export function hasPurge(): boolean {
  return Boolean(process.env.CLOUDFLARE_ZONE_ID && process.env.CLOUDFLARE_PURGE_TOKEN);
}

export async function purgeCache(): Promise<void> {
  if (!hasPurge()) return;

  const zone = requireEnv("CLOUDFLARE_ZONE_ID");
  const token = requireEnv("CLOUDFLARE_PURGE_TOKEN");

  try {
    const response = await fetch(`https://api.cloudflare.com/client/v4/zones/${zone}/purge_cache`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({ purge_everything: true }),
      signal: AbortSignal.timeout(8_000),
    });

    if (!response.ok) {
      console.error(`[purge] a Cloudflare recusou (HTTP ${response.status}):`, await response.text());
      return;
    }

    console.log("[purge] cache da Cloudflare limpo");
  } catch (error) {
    console.error("[purge] falhou, o cache expira sozinho pelo Edge TTL:", (error as Error).message);
  }
}
