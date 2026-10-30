import { resolveTracked } from "./aggregate";
import { applyIdentity, makeIdentity } from "./identity";
import { refreshProfiles } from "./profiles";
import { bumpDataRevision, getConfig, listMatches } from "./store";

export async function teamSteamIds(): Promise<Set<string>> {
  const [config, stored] = await Promise.all([getConfig(), listMatches()]);
  const identity = makeIdentity(config);
  const matches = stored.map((match) => applyIdentity(match, identity));
  return resolveTracked(matches, {
    ...config,
    trackedSteamIds: config.trackedSteamIds.map(identity.canonical),
  });
}

export async function refreshTeamProfiles(
  options: { maxAgeHours?: number } = {},
): Promise<number> {
  const updated = await refreshProfiles(Array.from(await teamSteamIds()), options);
  if (updated > 0) await bumpDataRevision();
  return updated;
}
