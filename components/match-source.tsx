import Image from "next/image";
import type { MatchRecord } from "@/lib/types";

const sources = {
  gamersClub: {
    label: "Gamers Club",
    title: "Gamers Club",
    icon: "/match-sources/gamersclub.png",
  },
  valve: {
    label: "MM (Valve)",
    title: "Matchmaking oficial da Valve",
    icon: "/match-sources/steam.png",
  },
  faceit: {
    label: "FACEIT",
    title: "FACEIT",
    icon: "/match-sources/faceit.png",
  },
};

function identifySource({ serverName, fileName }: Pick<MatchRecord, "serverName" | "fileName">) {
  const server = serverName?.trim() ?? "";
  if (/\bgamers\s*club\b/i.test(server)) return sources.gamersClub;
  if (/\bfaceit\b/i.test(server)) return sources.faceit;
  if (
    /^valve\b/i.test(server) ||
    /^match730_\d+_\d+(?:_\d+)?\.dem(?:\.(?:bz2|zst))?$/i.test(fileName)
  ) {
    return sources.valve;
  }
  return null;
}

export function MatchSource({ match }: { match: Pick<MatchRecord, "serverName" | "fileName"> }) {
  const source = identifySource(match);
  if (!source) return <span className="text-fog-500">Indefinida</span>;

  return (
    <span className="inline-flex items-center gap-1.5 align-middle text-fog-300" title={source.title}>
      <Image src={source.icon} alt="" width={16} height={16} className="shrink-0" unoptimized />
      {source.label}
    </span>
  );
}
