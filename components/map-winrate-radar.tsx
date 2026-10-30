import { mapLabel, pct } from "@/lib/format";
import { mapIconFor } from "@/lib/map-art";
import type { MapWinrateRow } from "@/components/map-winrate-chart";

const W = 520;
const H = 384;
const CX = W / 2;
const CY = 186;
const R = 126;
const LABEL_RADIUS = 1.12;
const ICON = 18;
const GAP = 7;
const RINGS = [0.25, 0.5, 0.75, 1];

export function MapWinrateRadar({ rows }: { rows: MapWinrateRow[] }) {
  if (rows.length < 3) return null;

  const ordered = [...rows].sort((a, b) => b.winRate - a.winRate || b.played - a.played);
  const angleOf = (index: number) => (index / ordered.length) * Math.PI * 2 - Math.PI / 2;
  const pointAt = (index: number, radius: number) => {
    const angle = angleOf(index);
    return [CX + Math.cos(angle) * radius * R, CY + Math.sin(angle) * radius * R] as const;
  };

  const shape = ordered
    .map((row, index) => {
      const [x, y] = pointAt(index, Math.max(row.winRate, 0.02));
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full max-w-[560px]"
        role="img"
        aria-label="Aproveitamento por mapa"
      >
        {RINGS.map((ring) => (
          <circle
            key={ring}
            cx={CX}
            cy={CY}
            r={ring * R}
            fill="none"
            stroke="var(--color-ink-700)"
            strokeOpacity={0.55}
          />
        ))}
        {ordered.map((row, index) => {
          const [x, y] = pointAt(index, 1);
          return (
            <line
              key={row.map}
              x1={CX}
              y1={CY}
              x2={x}
              y2={y}
              stroke="var(--color-ink-700)"
              strokeOpacity={0.55}
            />
          );
        })}
        <path
          d={`${shape} Z`}
          fill="var(--color-win)"
          fillOpacity={0.16}
          stroke="var(--color-win)"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle
          cx={CX}
          cy={CY}
          r={0.5 * R}
          fill="none"
          stroke="var(--color-fog-300)"
          strokeDasharray="3 3"
          strokeOpacity={0.7}
        />
        {ordered.map((row, index) => {
          const [px, py] = pointAt(index, Math.max(row.winRate, 0.02));
          const [lx, ly] = pointAt(index, LABEL_RADIUS);
          const icon = mapIconFor(row.map);
          const centred = Math.abs(lx - CX) < 16;
          const anchor = centred ? "middle" : lx > CX ? "start" : "end";
          const textX = centred ? lx : anchor === "start" ? lx + ICON + GAP : lx - ICON - GAP;
          const iconX = centred ? lx - ICON / 2 : anchor === "start" ? lx : lx - ICON;
          const nameY = centred ? ly + 4 : ly + 1;
          const iconY = centred ? nameY - ICON - 9 : nameY - ICON / 2 - 3;
          const above = row.winRate >= 0.5;
          return (
            <g key={row.map}>
              <circle cx={px} cy={py} r={4.5} fill={above ? "var(--color-win)" : "var(--color-loss)"} />
              {icon ? <image href={icon} x={iconX} y={iconY} width={ICON} height={ICON} /> : null}
              <text x={textX} y={nameY} textAnchor={anchor} className="fill-fog-100 text-[12px]">
                {mapLabel(row.map)}
              </text>
              <text x={textX} y={nameY + 15} textAnchor={anchor} className="text-[12px]">
                <tspan className={above ? "fill-win" : "fill-loss"} fontWeight={600}>
                  {pct(row.winRate)}
                </tspan>
                <tspan className="fill-fog-500"> · {row.played}j</tspan>
              </text>
            </g>
          );
        })}
      </svg>
      <p className="max-w-[520px] text-center text-[11px] text-fog-500">
        Cada eixo é um mapa: o melhor no topo e os outros em sentido horário, do melhor para o pior.
        O anel tracejado é o 50% — o que escapa dele para fora é mapa ganho.
      </p>
    </div>
  );
}
