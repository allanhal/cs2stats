const MAPS_WITH_ART = new Set([
  "cs_agency",
  "cs_italy",
  "cs_office",
  "de_ancient",
  "de_anubis",
  "de_basalt",
  "de_brewery",
  "de_cache",
  "de_dogtown",
  "de_dust2",
  "de_edin",
  "de_grail",
  "de_inferno",
  "de_jura",
  "de_mirage",
  "de_nuke",
  "de_overpass",
  "de_palais",
  "de_train",
  "de_vertigo",
  "de_whistle",
]);

export const hasMapArt = (map: string) => MAPS_WITH_ART.has(map);

const ROTATION = [
  "de_mirage",
  "de_nuke",
  "de_anubis",
  "de_overpass",
  "de_ancient",
  "de_inferno",
  "de_vertigo",
  "de_train",
  "de_dust2",
  "de_cache",
  "cs_italy",
  "de_edin",
  "de_grail",
  "de_palais",
  "de_jura",
  "cs_office",
  "de_whistle",
  "de_brewery",
  "de_dogtown",
  "de_basalt",
  "cs_agency",
];

export function backdropMapOf(date: Date): string {
  const day = Math.floor(date.getTime() / 86_400_000);
  return ROTATION[day % ROTATION.length];
}

export const mapIconFor = (map: string) => (hasMapArt(map) ? `/map-icons/${map}.png` : null);

export const mapHeroFor = (map: string) => (hasMapArt(map) ? `/map-heroes/${map}.jpg` : null);
