interface Radar {
  image: string;
  posX: number;
  posY: number;
  scale: number;
}

const base = "https://raw.githubusercontent.com/setposgg/cs2-minimaps/main/maps";

const radars: Record<string, Radar> = {
  de_mirage: { image: `${base}/mirage/mirage.svg`, posX: -3230, posY: 1713, scale: 5 },
  de_dust2: { image: `${base}/dust2/dust2.svg`, posX: -2476, posY: 3239, scale: 4.4 },
  de_anubis: { image: `${base}/anubis/anubis.svg`, posX: -2796, posY: 3328, scale: 5.22 },
  de_inferno: { image: `${base}/inferno/inferno.svg`, posX: -2087, posY: 3870, scale: 4.9 },
  de_ancient: { image: `${base}/ancient/ancient.svg`, posX: -2953, posY: 2164, scale: 5 },
  de_nuke: { image: `${base}/nuke/nuke.svg`, posX: -3453, posY: 2887, scale: 7 },
  de_cache: { image: `${base}/cache/cache.svg`, posX: -2000, posY: 3250, scale: 5.5 },
};

export function radarFor(map: string): Radar | null {
  return radars[map] ?? null;
}
