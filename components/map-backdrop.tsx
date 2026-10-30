import { backdropMapOf, mapHeroFor } from "@/lib/map-art";
import { mapLabel } from "@/lib/format";

export function MapBackdrop() {
  const map = backdropMapOf(new Date());
  const art = mapHeroFor(map);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {art ? (
        <img
          src={art}
          alt=""
          title={mapLabel(map)}
          className="absolute inset-0 size-full scale-105 object-cover opacity-[0.13] blur-[3px]"
        />
      ) : null}
      <div className="absolute inset-0 bg-gradient-to-b from-ink-950/80 via-ink-950/93 to-ink-950" />
      <div className="absolute inset-0 bg-[radial-gradient(1100px_520px_at_12%_-12%,#1a2033_0%,transparent_62%),radial-gradient(900px_480px_at_88%_0%,#161d2b_0%,transparent_58%)] opacity-80" />
    </div>
  );
}
