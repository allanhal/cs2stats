export const pct = (v: number, digits = 0) =>
  `${(Math.min(Math.max(v, 0), 1) * 100).toFixed(digits)}%`;

export const num = (v: number, digits = 2) => v.toFixed(digits);

export function mapLabel(map: string): string {
  const name = map.replace(/^de_|^cs_/, "");
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function duration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function dateLabel(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function dateTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const bytes = (n: number) => `${(n / 1e6).toFixed(0)} MB`;

export const BUY_LABELS: Record<string, string> = {
  pistol: "Pistola",
  eco: "Eco",
  force: "Force buy",
  semi: "Semi buy",
  full: "Full buy",
};

export const REASON_LABELS: Record<string, string> = {
  bomb_exploded: "Bomba explodiu",
  bomb_defused: "Bomba desarmada",
  ct_elimination: "CT eliminou",
  t_elimination: "TR eliminou",
  time_expired: "Tempo esgotado",
  ct_surrender: "CT desistiu",
  t_surrender: "TR desistiu",
  draw: "Empate",
};

export function cleanNick(nick: string): string {
  const stripped = nick

    .replace(/^[\s\u2460-\u24FF\u2776-\u2793\u3251-\u32BF]+/u, "")
    .replace(/^[\s✓✔★☆✦❤♥]+/u, "")
    .trim();
  return stripped || nick.trim();
}

const WEAPON_LABELS: Record<string, string> = {
  ak47: "AK-47",
  m4a1: "M4A4",
  m4a1_silencer: "M4A1-S",
  awp: "AWP",
  ssg08: "SSG 08",
  scar20: "SCAR-20",
  g3sg1: "G3SG1",
  aug: "AUG",
  sg556: "SG 553",
  famas: "FAMAS",
  galilar: "Galil AR",
  mac10: "MAC-10",
  mp9: "MP9",
  mp7: "MP7",
  mp5sd: "MP5-SD",
  ump45: "UMP-45",
  p90: "P90",
  bizon: "PP-Bizon",
  nova: "Nova",
  xm1014: "XM1014",
  mag7: "MAG-7",
  sawedoff: "Sawed-Off",
  m249: "M249",
  negev: "Negev",
  deagle: "Desert Eagle",
  revolver: "R8 Revolver",
  glock: "Glock-18",
  usp_silencer: "USP-S",
  hkp2000: "P2000",
  p250: "P250",
  fiveseven: "Five-SeveN",
  tec9: "Tec-9",
  cz75a: "CZ75-Auto",
  elite: "Dual Berettas",
  hegrenade: "Granada HE",
  molotov: "Molotov",
  incgrenade: "Incendiária",
  inferno: "Fogo",
  flashbang: "Flashbang",
  smokegrenade: "Fumaça",
  decoy: "Decoy",
  taser: "Zeus x27",
  world: "Mapa",
};

export function weaponLabel(weapon: string): string {
  if (WEAPON_LABELS[weapon]) return WEAPON_LABELS[weapon];
  if (weapon.startsWith("knife") || weapon === "bayonet") return "Faca";
  return weapon.replace(/_/g, " ").toUpperCase();
}
