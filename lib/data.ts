import { getConfig, listMatches } from "./store";
import { detectTeamName, resolveTracked, viewMatch, type MatchView } from "./aggregate";
import { applyIdentity, makeIdentity } from "./identity";
import { loadProfiles, type Profiles } from "./profiles";
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
    loadProfiles(),
  ]);

  const identity = makeIdentity(config, profiles);
  const matches = stored.map((m) => applyIdentity(m, identity));
  const tracked = resolveTracked(matches, {
    ...config,
    trackedSteamIds: config.trackedSteamIds.map(identity.canonical),
  });

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
    profiles,
  };
}

const DEFAULT_TEAM_NAME = "Nosso time";
