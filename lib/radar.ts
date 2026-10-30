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
  de_overpass: { image: "/radar/de_overpass.png", posX: -4831, posY: 1781, scale: 5.2 },
  de_vertigo: { image: "/radar/de_vertigo.png", posX: -3168, posY: 1762, scale: 4 },
  de_train: { image: "/radar/de_train.png", posX: -2308, posY: 2078, scale: 4.082077 },
  de_basalt: { image: "/radar/de_basalt.png", posX: -2345.6, posY: 2391.8, scale: 4.37 },
  de_brewery: { image: "/radar/de_brewery.png", posX: -4122.4, posY: 4394.4, scale: 4.3640624 },
  de_dogtown: { image: "/radar/de_dogtown.png", posX: -1741.0228, posY: 3295.1, scale: 2.0323243 },
  de_edin: { image: "/radar/de_edin.png", posX: -383.30038, posY: 4420.2134, scale: 4.803717 },
  de_grail: { image: "/radar/de_grail.png", posX: -4395.903, posY: 4203.903, scale: 4.3513728 },
  de_jura: { image: "/radar/de_jura.png", posX: -2126.9092, posY: 2389.8, scale: 5.008376 },
  de_palais: { image: "/radar/de_palais.png", posX: -1353.2374, posY: 2044.8105, scale: 2.8003397 },
  de_whistle: { image: "/radar/de_whistle.png", posX: -1825.6, posY: 1104.82, scale: 2.8 },
  cs_agency: { image: "/radar/cs_agency.png", posX: -2597.7368, posY: 2079.3687, scale: 4.1817436 },
  cs_italy: { image: "/radar/cs_italy.png", posX: -2647, posY: 2592, scale: 4.6 },
  cs_office: { image: "/radar/cs_office.png", posX: -1838, posY: 1858, scale: 4.1 },
};

export function radarFor(map: string): Radar | null {
  return radars[map] ?? null;
}
