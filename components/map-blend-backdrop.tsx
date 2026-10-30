import { mapHeroFor } from "@/lib/map-art";

function maskFor(index: number, total: number): string {
  if (total === 1) return "linear-gradient(to right, black, black)";
  if (index === 0) return "linear-gradient(to right, black 55%, transparent 100%)";
  if (index === total - 1) return "linear-gradient(to right, transparent 0%, black 45%)";
  return "linear-gradient(to right, transparent 0%, black 40%, black 60%, transparent 100%)";
}

export function MapBlendLayer({ maps, opacity }: { maps: string[]; opacity: string }) {
  const arts = maps.map((map) => mapHeroFor(map)).filter((art): art is string => Boolean(art));
  if (arts.length === 0) return null;

  const width = arts.length === 1 ? 100 : 55;
  const step = arts.length === 1 ? 0 : (100 - width) / (arts.length - 1);

  return (
    <>
      {arts.map((art, index) => (
        <img
          key={art}
          src={art}
          alt=""
          className={`absolute inset-y-0 h-full object-cover ${opacity}`}
          style={{
            left: `${index * step}%`,
            width: `${width}%`,
            maskImage: maskFor(index, arts.length),
            WebkitMaskImage: maskFor(index, arts.length),
          }}
        />
      ))}
    </>
  );
}

export function MapBlendBackdrop({ maps }: { maps: string[] }) {
  const arts = maps.map((map) => mapHeroFor(map)).filter((art): art is string => Boolean(art));
  if (arts.length === 0) return null;

  const width = arts.length === 1 ? 100 : 55;
  const step = arts.length === 1 ? 0 : (100 - width) / (arts.length - 1);

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl">
      {arts.map((art, index) => (
        <img
          key={art}
          src={art}
          alt=""
          className="absolute inset-y-0 h-full object-cover opacity-[0.28]"
          style={{
            left: `${index * step}%`,
            width: `${width}%`,
            maskImage: maskFor(index, arts.length),
            WebkitMaskImage: maskFor(index, arts.length),
          }}
        />
      ))}
      <div className="absolute inset-0 bg-gradient-to-t from-ink-900/95 via-ink-900/80 to-ink-900/70" />
    </div>
  );
}
