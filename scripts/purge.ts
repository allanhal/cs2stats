import { hasPurge, purgeCache } from "../lib/purge";

async function main() {
  if (!hasPurge()) {
    console.log("[purge] CLOUDFLARE_ZONE_ID ou CLOUDFLARE_PURGE_TOKEN ausentes; nada a limpar");
    return;
  }
  await purgeCache();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
