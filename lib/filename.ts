export interface FileNameMeta {
  playedAt: string | null;
  map: string | null;
  teams: { A: string; B: string } | null;
}

const titleCase = (slug: string): string =>
  slug
    .split("-")
    .filter(Boolean)
    .map((word) =>
      word.length <= 3 && word === word.toLowerCase() && !/^\d+$/.test(word)
        ? word.toUpperCase()
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");

export function parseFileName(fileName: string): FileNameMeta {
  const empty: FileNameMeta = { playedAt: null, map: null, teams: null };
  const base = fileName.replace(/\.dem(\.bz2|\.gz|\.zst)?$/i, "");
  const parts = base.split("__");
  if (parts.length < 2) return empty;

  const [date, time] = parts;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return empty;
  const hour = /^\d{4}$/.test(time ?? "") ? `${time.slice(0, 2)}:${time.slice(2)}` : "00:00";
  const parsed = new Date(`${date}T${hour}:00`);
  if (Number.isNaN(parsed.getTime())) return empty;

  const mapPart = parts.find((part) => /^(de|cs)_/.test(part)) ?? null;
  const versus = parts.indexOf("vs");
  const teams =
    versus > 0 && parts[versus - 1] && parts[versus + 1]
      ? { A: titleCase(parts[versus - 1]), B: titleCase(parts[versus + 1]) }
      : null;

  return { playedAt: parsed.toISOString(), map: mapPart, teams };
}
