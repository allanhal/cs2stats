import { getPool } from "../lib/db";
import { loadProfiles, refreshProfiles } from "../lib/profiles";
import { listMatches } from "../lib/store";

async function main() {
  if (!process.env.STEAM_API_KEY) throw new Error("falta STEAM_API_KEY");

  const matches = await listMatches();
  const steamIds = [...new Set(matches.flatMap((m) => m.players.map((p) => p.steamId)))];
  console.log(`${steamIds.length} jogadores em ${matches.length} partidas`);

  const fetched = await refreshProfiles(steamIds, {
    maxAgeHours: process.argv.includes("--all") ? 0 : 24 * 7,
  });
  console.log(`${fetched} perfil(is) atualizado(s)\n`);

  const profiles = await loadProfiles();
  for (const id of steamIds) {
    const profile = profiles[id];
    if (profile) console.log(`  ${profile.persona}`);
  }

  await getPool().end();
}

main().catch((error) => {
  console.error(`\n✗ ${error instanceof Error ? error.message : error}`);
  process.exit(1);
});
