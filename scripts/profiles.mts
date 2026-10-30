import { getPool } from "../lib/db";
import { loadProfiles } from "../lib/profiles";
import { refreshTeamProfiles, teamSteamIds } from "../lib/team-profiles";

async function main() {
  if (!process.env.STEAM_API_KEY) throw new Error("falta STEAM_API_KEY");

  const steamIds = Array.from(await teamSteamIds());
  console.log(`${steamIds.length} jogadores do time`);

  const fetched = await refreshTeamProfiles({
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
