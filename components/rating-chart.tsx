import { dateLabel, mapLabel } from "@/lib/format";

export interface RatingPoint {
  matchId: string;
  date: string;
  map: string;
  won: boolean;
  rating: number;
  adr: number;
  kills: number;
  deaths: number;
}

const LINE = "#4f96d6";
const WIN = "var(--color-win)";
const LOSS = "var(--color-loss)";

const W = 720;
const H = 200;
const PAD = { top: 18, right: 16, bottom: 26, left: 36 };

export function RatingChart({ points, label }: { points: RatingPoint[]; label: string }) {
  if (points.length < 3) return null;

  const values = points.map((p) => p.rating);
  const low = Math.min(...values, 1);
  const high = Math.max(...values, 1);
  const min = Math.max(0, Math.floor((low - 0.1) * 10) / 10);
  const max = Math.ceil((high + 0.1) * 10) / 10;

  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const x = (i: number) =>
    PAD.left + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW);
  const y = (value: number) => PAD.top + innerH - ((value - min) / (max - min)) * innerH;

  const path = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.rating)}`).join(" ");
  const best = points.reduce((a, b) => (b.rating > a.rating ? b : a));
  const bestIndex = points.indexOf(best);
  const last = points.length - 1;

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-auto w-full"
        role="img"
        aria-label={`Rating de ${label} por partida, da mais antiga para a mais recente. Variou de ${Math.min(...values).toFixed(2)} a ${Math.max(...values).toFixed(2)}.`}
      >
        {}
        <line
          x1={PAD.left}
          x2={W - PAD.right}
          y1={y(1)}
          y2={y(1)}
          stroke="var(--color-ink-700)"
          strokeWidth="1"
          strokeDasharray="3 3"
        />
        <text x={PAD.left - 6} y={y(1) + 3.5} textAnchor="end" className="fill-fog-500 text-[10px]">
          1.00
        </text>
        <text x={PAD.left - 6} y={y(max) + 3.5} textAnchor="end" className="fill-fog-500 text-[10px]">
          {max.toFixed(2)}
        </text>
        <text x={PAD.left - 6} y={y(min) + 3.5} textAnchor="end" className="fill-fog-500 text-[10px]">
          {min.toFixed(2)}
        </text>

        <path d={path} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />

        {points.map((p, i) => {
          const px = x(i);
          const py = y(p.rating);
          const flip = px > W - 150;
          const tipW = 146;
          const tipX = flip ? px - tipW - 10 : px + 10;
          const tipY = Math.min(Math.max(py - 30, 2), H - 62);

          return (
            <g key={p.matchId} className="chart-point" tabIndex={0}>
              {}
              <rect
                x={px - 14}
                y={PAD.top}
                width="28"
                height={innerH}
                fill="transparent"
              />
              <circle
                className="chart-dot"
                cx={px}
                cy={py}
                r="4"
                fill={p.won ? WIN : "var(--color-ink-900)"}
                stroke={p.won ? WIN : LOSS}
                strokeWidth="2"
              />

              <g className="chart-tip">
                <rect
                  x={tipX}
                  y={tipY}
                  width={tipW}
                  height="60"
                  rx="6"
                  fill="var(--color-ink-800)"
                  stroke="var(--color-ink-700)"
                />
                <text x={tipX + 10} y={tipY + 17} className="fill-fog-100 text-[11px] font-semibold">
                  {mapLabel(p.map)} · {p.won ? "vitória" : "derrota"}
                </text>
                <text x={tipX + 10} y={tipY + 32} className="fill-fog-300 text-[11px]">
                  rating {p.rating.toFixed(2)} · ADR {p.adr.toFixed(0)}
                </text>
                <text x={tipX + 10} y={tipY + 46} className="fill-fog-500 text-[10px]">
                  {p.kills}–{p.deaths} · {dateLabel(p.date)}
                </text>
              </g>
            </g>
          );
        })}

        {}
        {bestIndex !== last ? (
          <text
            x={x(bestIndex)}
            y={y(best.rating) - 10}
            textAnchor="middle"
            className="fill-fog-300 text-[10px]"
          >
            {best.rating.toFixed(2)}
          </text>
        ) : null}
        <text
          x={x(last)}
          y={y(points[last].rating) - 10}
          textAnchor="end"
          className="fill-fog-100 text-[11px] font-semibold"
        >
          {points[last].rating.toFixed(2)}
        </text>

        <text x={PAD.left} y={H - 8} className="fill-fog-500 text-[10px]">
          {dateLabel(points[0].date)}
        </text>
        <text x={W - PAD.right} y={H - 8} textAnchor="end" className="fill-fog-500 text-[10px]">
          {dateLabel(points[last].date)}
        </text>
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-fog-500">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="4" fill={WIN} />
          </svg>
          vitória
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10" aria-hidden="true">
            <circle cx="5" cy="5" r="3" fill="var(--color-ink-900)" stroke={LOSS} strokeWidth="2" />
          </svg>
          derrota
        </span>
        <span>a linha tracejada é 1.00, o rating de um jogador médio</span>
      </figcaption>
    </figure>
  );
}
