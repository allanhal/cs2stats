import { extractMatch } from "../lib/extract";
import { basename } from "node:path";

const path = process.argv[2];
const m = extractMatch(path, { fileName: basename(path), uploadedBy: "dev" });

console.log(`${m.map} | ${m.teamLabel.A} ${m.score.A}-${m.score.B} ${m.teamLabel.B} | ${m.totalRounds} rounds | ${Math.round(m.durationSeconds/60)}min`);
console.log(`jogada em: ${m.playedAt}${m.playedAtKnown ? " (do nome do arquivo)" : " (data do upload — nome fora do padrão)"}`);
console.log(`clan tags na demo: A="${m.clanName.A}" B="${m.clanName.B}" | A começou ${m.startingSide.A}`);

console.log("\n--- placar");
console.log(" sq nome                 rnd  K  D  A hs%  adr kast% 0k  op+/-  clutch  mk(2/3/4/5)");
for (const p of m.players) {
  const mk = `${p.multiKills.k2}/${p.multiKills.k3}/${p.multiKills.k4}/${p.multiKills.k5}`;
  const cl = Object.values(p.clutchesWon).reduce((a,b)=>a+b,0);
  console.log(` ${p.squad}  ${p.name.slice(0,18).padEnd(18)} ${String(p.roundsPlayed).padStart(3)} ${String(p.kills).padStart(2)} ${String(p.deaths).padStart(2)} ${String(p.assists).padStart(2)} ${String(Math.round(p.headshotKills/Math.max(p.kills,1)*100)).padStart(3)} ${String(Math.round(p.damage/p.roundsPlayed)).padStart(4)} ${String(Math.round(p.kastRounds/p.roundsPlayed*100)).padStart(4)}% ${String(p.zeroKillRounds).padStart(2)} ${(p.openingKills+"/"+p.openingDeaths).padStart(6)} ${(cl+"/"+p.clutchesPlayed).padStart(7)} ${mk.padStart(12)}`);
}

console.log("\n--- hall da vergonha");
console.log(" nome                 TK  morto-por-aliado  dano-aliado  auto-dano  flash-aliado  auto-flash  flash-inimigo");
for (const p of [...m.players].sort((a,b)=> (b.teamDamage+b.teamFlashSeconds*10) - (a.teamDamage+a.teamFlashSeconds*10))) {
  console.log(` ${p.name.slice(0,18).padEnd(18)} ${String(p.teamKills).padStart(3)} ${String(p.teamKillDeaths).padStart(17)} ${String(p.teamDamage).padStart(12)} ${String(p.selfDamage).padStart(10)} ${(p.teamFlashes+"x "+p.teamFlashSeconds+"s").padStart(13)} ${(p.selfFlashes+"x "+p.selfFlashSeconds+"s").padStart(11)} ${(p.enemyFlashSeconds+"s").padStart(13)}`);
}

console.log("\n--- estilo");
console.log(" nome                 cegos  no-scope  pelo-smoke  wallbang");
for (const p of m.players) {
  if (p.blindKills+p.noScopeKills+p.throughSmokeKills+p.wallbangKills === 0) continue;
  console.log(` ${p.name.slice(0,18).padEnd(18)} ${String(p.blindKills).padStart(5)} ${String(p.noScopeKills).padStart(9)} ${String(p.throughSmokeKills).padStart(11)} ${String(p.wallbangKills).padStart(9)}`);
}

console.log("\n--- callouts: onde o time A mata e morre");
const agg = (key: "killsByPlace" | "deathsByPlace", squad: "A"|"B") => {
  const out: Record<string, number> = {};
  for (const p of m.players.filter(p=>p.squad===squad)) for (const [k,v] of Object.entries(p[key])) out[k]=(out[k]??0)+v;
  return out;
};
const k = agg("killsByPlace","A"), d = agg("deathsByPlace","A");
const places = [...new Set([...Object.keys(k), ...Object.keys(d)])].sort((x,y)=>((k[y]??0)+(d[y]??0))-((k[x]??0)+(d[x]??0)));
for (const place of places.slice(0,10)) console.log(` ${place.padEnd(20)} kills ${String(k[place]??0).padStart(3)}  deaths ${String(d[place]??0).padStart(3)}`);

console.log("\nJSON:", (JSON.stringify(m).length/1024).toFixed(1), "KB");
