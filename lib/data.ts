import { getConfig, getProfiles, listMatches } from "./store";
import { detectTeamName, resolveTracked, viewMatch, type MatchView } from "./aggregate";
import { applyIdentity, makeIdentity } from "./identity";
import type { Profiles } from "./profiles";
import type { AppConfig, MatchRecord } from "./types";

export interface Dataset {
  views: MatchView[];
  tracked: Set<string>;
  config: AppConfig;

  matches: MatchRecord[];

  profiles: Profiles;
}

export async function loadDataset(): Promise<Dataset> {
  const [config, stored, profiles] = await Promise.all([
    getConfig(),
    listMatches(),
    getProfiles(),
  ]);

  const identity = makeIdentity(config, profiles);
  const identified = stored.map((m) => applyIdentity(m, identity));
  const tracked = resolveTracked(identified, {
    ...config,
    trackedSteamIds: config.trackedSteamIds.map(identity.canonical),
  });

  const teamProfiles: Profiles = {};
  for (const [steamId, profile] of Object.entries(profiles)) {
    const canonical = identity.canonical(steamId);
    if (!tracked.has(canonical)) continue;
    teamProfiles[steamId] = profile;
    teamProfiles[canonical] ??= profile;
  }
  const matches = identified.map((match) => applyIdentity(match, makeIdentity(config, teamProfiles)));

  const views = matches.map((m) => viewMatch(m, tracked));

  const teamName =
    config.teamName && config.teamName !== DEFAULT_TEAM_NAME
      ? config.teamName
      : (detectTeamName(views) ?? DEFAULT_TEAM_NAME);

  return {
    views,
    tracked,
    config: { ...config, teamName },
    matches,
    profiles: teamProfiles,
  };
}

const DEFAULT_TEAM_NAME = "Nosso time";
