import { getPool } from "../lib/db";
import { listMatches } from "../lib/store";
const matches = await listMatches();
const seen = new Map<string, { name: string; matches: number; kills: number }>();
for (const m of matches) {
  for (const p of m.players) {
    const s = seen.get(p.steamId) ?? { name: p.name, matches: 0, kills: 0 };
    s.name = p.name; s.matches++; s.kills += p.kills;
    seen.set(p.steamId, s);
  }
}
for (const [id, s] of [...seen].sort((a, b) => b[1].matches - a[1].matches || b[1].kills - a[1].kills)) {
  console.log(id, String(s.matches).padStart(2), String(s.kills).padStart(3), s.name);
}
await getPool().end();
