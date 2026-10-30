import { AdminLogin } from "@/components/admin-login";
import { AdminPanel, type AdminMatch, type AdminPlayer } from "@/components/admin-panel";
import { resolveTracked, viewMatch } from "@/lib/aggregate";
import { isAdmin } from "@/lib/auth";
import { makeIdentity } from "@/lib/identity";
import { getConfig, listMatches } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await isAdmin())) return <AdminLogin />;

  const config = await getConfig();
  const matches = await listMatches();
  const identity = makeIdentity(config);
  const tracked = resolveTracked(matches, config);

  const adminMatches: AdminMatch[] = matches.map((match) => {
    const v = viewMatch(match, tracked);
    return {
      id: match.id,
      map: match.map,
      ourScore: v.ourScore,
      theirScore: v.theirScore,
      result: v.result,
      opponent: v.opponent,
      rounds: match.totalRounds,
      playedAt: match.playedAt,
      playedAtKnown: match.playedAtKnown,
      uploadedAt: match.uploadedAt,
      uploadedBy: match.uploadedBy,
      fileName: match.fileName,
      fileSizeBytes: match.fileSizeBytes,
    };
  });

  const seen = new Map<string, { names: Set<string>; matches: number }>();
  for (const match of matches) {
    for (const player of match.players) {
      const slot = seen.get(player.steamId) ?? { names: new Set<string>(), matches: 0 };
      slot.names.add(player.name);
      slot.matches++;
      seen.set(player.steamId, slot);
    }
  }

  const groups = new Map<string, AdminPlayer>();
  for (const [steamId, slot] of seen) {
    const canonical = identity.canonical(steamId);
    const names = Array.from(slot.names);
    let group = groups.get(canonical);
    if (!group) {
      group = {
        steamId: canonical,
        name: "",
        rawNames: [],
        matches: 0,
        tracked: config.trackedSteamIds.includes(canonical),
        hidden: config.hiddenSteamIds.includes(canonical),
        customName: config.displayNames[canonical] ?? null,
        merged: [],
      };
      groups.set(canonical, group);
    }
    group.matches += slot.matches;
    for (const name of names) if (!group.rawNames.includes(name)) group.rawNames.push(name);
    if (steamId !== canonical) {
      group.merged.push({ steamId, names, hidden: config.hiddenSteamIds.includes(steamId) });
    }
  }

  const players: AdminPlayer[] = Array.from(groups.values())
    .map((group) => ({
      ...group,
      name: group.customName ?? group.rawNames[0] ?? group.steamId,
    }))
    .sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));

  return (
    <AdminPanel
      matches={adminMatches}
      players={players}
      teamName={config.teamName}
      autoDetected={config.trackedSteamIds.length === 0}
    />
  );
}
