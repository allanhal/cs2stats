import Image from "next/image";
import type { HitGroup, Side } from "@/lib/types";
import { pct } from "@/lib/format";

const REGIONS: { group: HitGroup; label: string }[] = [
  { group: "head", label: "Cabeça" },
  { group: "chest", label: "Peito" },
  { group: "stomach", label: "Barriga" },
  { group: "arms", label: "Braços" },
  { group: "legs", label: "Pernas" },
];

const SKIN = {
  CT: {
    color: "var(--color-ct)",
    image: "/cs2-hitbox-ct.png",
    label: "Alvos CT",
    model: "Operador CT padrão do CS2",
    hint: "Acertos que ele deu jogando de TR",
  },
  T: {
    color: "var(--color-tr)",
    image: "/cs2-hitbox-t.png",
    label: "Alvos TR",
    model: "Operador TR padrão do CS2",
    hint: "Acertos que ele deu jogando de CT",
  },
} as const;

const ZONES: Record<HitGroup, string[]> = {
  head: ["left-[36%] top-[5%] h-[20%] w-[28%] rounded-[45%]"],
  chest: ["left-[23%] top-[25%] h-[24%] w-[54%] rounded-[35%]"],
  stomach: ["left-[31%] top-[49%] h-[11%] w-[38%] rounded-[30%]"],
  arms: [
    "left-[9%] top-[27%] h-[36%] w-[18%] rounded-[45%]",
    "right-[9%] top-[27%] h-[36%] w-[18%] rounded-[45%]",
  ],
  legs: ["left-[28%] top-[60%] h-[36%] w-[44%] rounded-[40%]"],
  other: [],
};

export function Hitbox({ side, hits }: { side: Side; hits: Record<HitGroup, number> }) {
  const skin = SKIN[side];
  const total = REGIONS.reduce((sum, r) => sum + hits[r.group], 0) + hits.other;
  const peak = Math.max(...REGIONS.map((r) => hits[r.group]), 1);
  const shade = (group: HitGroup) => 0.1 + 0.3 * (hits[group] / peak);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between gap-2">
        <h4 className="text-sm font-medium" style={{ color: skin.color }}>
          {skin.label}
        </h4>
        <span className="tnum text-[11px] text-fog-500">{total} acertos</span>
      </div>
      <div className="flex items-start gap-4">
        <figure
          className="relative h-56 w-36 shrink-0 overflow-hidden rounded-xl border border-ink-800 bg-ink-900"
          aria-label={`Mapa de acertos no ${skin.model}: ${REGIONS.map(
            (r) => `${r.label} ${pct(hits[r.group] / Math.max(total, 1))}`,
          ).join(", ")}.`}
        >
          <Image
            src={skin.image}
            alt=""
            fill
            sizes="144px"
            className="object-contain object-top"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-950/80" />
          {REGIONS.flatMap((region) =>
            ZONES[region.group].map((zone, index) => (
              <span
                key={`${region.group}-${index}`}
                className={`absolute border ${zone}`}
                style={{
                  backgroundColor: skin.color,
                  borderColor: skin.color,
                  opacity: shade(region.group),
                }}
              />
            )),
          )}
          <figcaption className="absolute inset-x-0 bottom-0 px-2 pb-2 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-fog-300">
            Modelo CS2
          </figcaption>
        </figure>

        <dl className="min-w-0 flex-1 space-y-2">
          {REGIONS.map((r) => {
            const share = hits[r.group] / Math.max(total, 1);
            return (
              <div key={r.group}>
                <div className="flex items-baseline justify-between gap-2 text-xs">
                  <dt className="text-fog-500">{r.label}</dt>
                  <dd className="tnum">
                    {hits[r.group]}
                    <span className="ml-1.5 text-fog-500">{pct(share)}</span>
                  </dd>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-ink-800">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(100, share * 100)}%`,
                      background: skin.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </dl>
      </div>
      <p className="text-[11px] text-fog-500">{skin.hint}</p>
    </div>
  );
}
