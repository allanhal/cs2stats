"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type HeatPoint = { x: number; y: number; seconds: number; kills: number; deaths: number };

type RouteHeatmapProps = {
  id: string;
  side: "CT" | "T";
  radar: { image: string };
  points: HeatPoint[];
  rounds: number;
  controls?: boolean;
};

type Metric = "presence" | "kills" | "deaths" | "balance";
type Mode = "points" | "gradient";

const HeatmapMetricContext = createContext<{
  metric: Metric;
  setMetric: (metric: Metric) => void;
  mode: Mode;
  setMode: (mode: Mode) => void;
} | null>(null);

export function RouteHeatmapGroup({
  children,
  defaultMetric = "presence",
}: {
  children: ReactNode;
  defaultMetric?: Metric;
}) {
  const [metric, setMetric] = useState<Metric>(defaultMetric);
  const [mode, setMode] = useState<Mode>("points");

  return (
    <HeatmapMetricContext.Provider value={{ metric, setMetric, mode, setMode }}>
      {children}
    </HeatmapMetricContext.Provider>
  );
}

const MODE_LABELS: [Mode, string][] = [
  ["points", "Pontos"],
  ["gradient", "Gradiente"],
];

const METRIC_LABELS: [Metric, string][] = [
  ["presence", "Presença"],
  ["kills", "Kills"],
  ["deaths", "Mortes"],
  ["balance", "Saldo"],
];

const GOOD = "#5fd08a";
const EVEN = "#e8c24a";
const BAD = "#e0564f";
const IDLE = "#08090c";

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m${String(Math.round(seconds % 60)).padStart(2, "0")}s`;
}

function formatRate(count: number, seconds: number): string {
  if (seconds <= 0) return "—";
  return ((count * 60) / seconds).toFixed(1).replace(".", ",");
}

function formatBalance(kills: number, deaths: number, seconds: number): string {
  if (seconds <= 0) return "—";
  const value = ((kills - deaths) * 60) / seconds;
  return `${value > 0 ? "+" : ""}${value.toFixed(1).replace(".", ",")}`;
}

function formatPerRound(count: number, rounds: number, signed = false): string {
  if (rounds <= 0) return "—";
  const value = count / rounds;
  const text = value.toFixed(2).replace(".", ",");
  return signed && value > 0 ? `+${text}` : text;
}

export function RouteHeatmapControls() {
  const selection = useContext(HeatmapMetricContext);
  if (!selection) throw new Error("RouteHeatmapControls requires RouteHeatmapGroup");
  const { metric, setMetric, mode, setMode } = selection;

  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px]">
      <Toggle
        options={METRIC_LABELS}
        value={metric}
        onChange={(next) => setMetric(next)}
      />
      <Toggle
        options={MODE_LABELS}
        value={mode}
        onChange={(next) => setMode(next)}
      />
    </div>
  );
}

function Toggle<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="inline-flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
      {options.map(([option, label]) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={`rounded px-2 py-1 transition ${
            value === option ? "bg-ink-700 text-fog-100" : "text-fog-500 hover:text-fog-200"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

export function RouteHeatmap({
  id,
  side,
  radar,
  points,
  rounds,
  controls = true,
}: RouteHeatmapProps) {
  const selection = useContext(HeatmapMetricContext);
  if (!selection) throw new Error("RouteHeatmap requires RouteHeatmapGroup");
  const { metric, setMetric, mode, setMode } = selection;
  const [hovered, setHovered] = useState<number | null>(null);
  const [camera, setCamera] = useState({ zoom: 1, x: 50, y: 50 });
  const [drag, setDrag] = useState<{
    pointerId: number;
    clientX: number;
    clientY: number;
    camera: { zoom: number; x: number; y: number };
  } | null>(null);
  const bucketSize = camera.zoom < 1.5 ? 12 : camera.zoom < 2.25 ? 7 : camera.zoom < 3 ? 3.5 : 1;
  const visiblePoints = useMemo(() => {
    const buckets = new Map<
      string,
      { seconds: number; kills: number; deaths: number; weightedX: number; weightedY: number; weight: number }
    >();
    for (const point of points) {
      const key = `${Math.floor(point.x / bucketSize)}|${Math.floor(point.y / bucketSize)}`;
      const bucket =
        buckets.get(key) ?? { seconds: 0, kills: 0, deaths: 0, weightedX: 0, weightedY: 0, weight: 0 };
      const weight = Math.max(point.seconds, point.kills + point.deaths, 0.001);
      bucket.seconds += point.seconds;
      bucket.kills += point.kills;
      bucket.deaths += point.deaths;
      bucket.weightedX += point.x * weight;
      bucket.weightedY += point.y * weight;
      bucket.weight += weight;
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).map((bucket) => ({
      seconds: bucket.seconds,
      kills: bucket.kills,
      deaths: bucket.deaths,
      x: bucket.weightedX / bucket.weight,
      y: bucket.weightedY / bucket.weight,
    }));
  }, [bucketSize, points]);

  const valueOf = (point: HeatPoint) =>
    metric === "presence"
      ? point.seconds
      : metric === "kills"
        ? point.kills
        : metric === "deaths"
          ? point.deaths
          : Math.abs(point.kills - point.deaths);
  const drawnPoints = visiblePoints.filter((point) => valueOf(point) > 0);
  const peak = Math.max(...drawnPoints.map(valueOf), 1);
  const baseColor = side === "CT" ? "#5aa9f5" : "#e8b23a";
  const color = metric === "kills" ? GOOD : metric === "deaths" ? BAD : baseColor;
  const netOf = (point: HeatPoint) => point.kills - point.deaths;
  const colorOf = (point: HeatPoint) =>
    metric === "balance"
      ? netOf(point) > 0
        ? GOOD
        : netOf(point) < 0
          ? BAD
          : EVEN
      : color;
  const edgeOf = (point: HeatPoint) => {
    if (point.kills + point.deaths === 0) return IDLE;
    const net = netOf(point);
    if (net > 0) return GOOD;
    if (net < 0) return BAD;
    return EVEN;
  };
  const gradientId = `heat-gradient-${id}-${metric}`;
  const gradientBadId = `heat-gradient-bad-${id}`;
  const blurId = `heat-blur-${id}`;
  const span = 100 / camera.zoom;
  const detailLabel = bucketSize === 1 ? "Detalhe máximo" : bucketSize <= 3.5 ? "Detalhe" : "Visão geral";
  const hoveredPoint = hovered === null ? null : drawnPoints[hovered] ?? null;

  function clampCamera(next: { zoom: number; x: number; y: number }) {
    const zoom = Math.min(Math.max(next.zoom, 1), 4);
    const margin = 50 / zoom;
    return {
      zoom,
      x: Math.min(Math.max(next.x, margin), 100 - margin),
      y: Math.min(Math.max(next.y, margin), 100 - margin),
    };
  }

  function zoomTo(zoom: number, focusX = 50, focusY = 50) {
    setCamera((current) => {
      const nextZoom = Math.min(Math.max(zoom, 1), 4);
      const scale = current.zoom / nextZoom;
      return clampCamera({
        zoom: nextZoom,
        x: focusX + (current.x - focusX) * scale,
        y: focusY + (current.y - focusY) * scale,
      });
    });
  }

  const tooltip = (() => {
    if (!hoveredPoint) return null;
    const left = ((hoveredPoint.x - (camera.x - span / 2)) / span) * 100;
    const top = ((hoveredPoint.y - (camera.y - span / 2)) / span) * 100;
    if (left < -5 || left > 105 || top < -5 || top > 105) return null;
    const flipX = left > 55;
    const flipY = top > 65;
    const net = hoveredPoint.kills - hoveredPoint.deaths;
    const rows: [string, string, string, string][] = [
      ["Presença", formatDuration(hoveredPoint.seconds), "", `${rounds} rounds`],
      [
        "Kills",
        String(hoveredPoint.kills),
        `${formatRate(hoveredPoint.kills, hoveredPoint.seconds)}/min`,
        `${formatPerRound(hoveredPoint.kills, rounds)}/round`,
      ],
      [
        "Mortes",
        String(hoveredPoint.deaths),
        `${formatRate(hoveredPoint.deaths, hoveredPoint.seconds)}/min`,
        `${formatPerRound(hoveredPoint.deaths, rounds)}/round`,
      ],
      [
        "Saldo",
        `${net > 0 ? "+" : ""}${net}`,
        `${formatBalance(hoveredPoint.kills, hoveredPoint.deaths, hoveredPoint.seconds)}/min`,
        `${formatPerRound(net, rounds, true)}/round`,
      ],
    ];
    return (
      <div
        className="pointer-events-none absolute z-10 w-max rounded-md border bg-ink-950/95 px-2.5 py-2 shadow-lg backdrop-blur-sm"
        data-net={net}
        style={{
          left: `${left}%`,
          top: `${top}%`,
          transform: `translate(${flipX ? "calc(-100% - 10px)" : "10px"}, ${
            flipY ? "calc(-100% - 10px)" : "10px"
          })`,
          borderColor:
            hoveredPoint.kills + hoveredPoint.deaths === 0
              ? "#2b2f38"
              : net > 0
                ? GOOD
                : net < 0
                  ? BAD
                  : EVEN,
        }}
      >
        <table className="border-separate border-spacing-x-3 border-spacing-y-0.5 text-[11px] leading-tight">
          <tbody>
            {rows.map(([label, value, rate, perRound]) => (
              <tr key={label}>
                <td className="text-fog-500">{label}</td>
                <td
                  className="text-right font-medium tabular-nums"
                  style={
                    label === "Saldo" && hoveredPoint.kills + hoveredPoint.deaths > 0
                      ? { color: net > 0 ? GOOD : net < 0 ? BAD : EVEN }
                      : undefined
                  }
                >
                  {value}
                </td>
                <td className="text-right tabular-nums text-fog-500">{rate}</td>
                <td className="text-right tabular-nums text-fog-500">{perRound}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  })();

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        {controls ? (
          <>
            <Toggle
              options={METRIC_LABELS}
              value={metric}
              onChange={(next) => {
                setMetric(next);
                setHovered(null);
              }}
            />
            <Toggle options={MODE_LABELS} value={mode} onChange={(next) => setMode(next)} />
          </>
        ) : null}
        <div className="inline-flex items-center rounded-md border border-ink-700 bg-ink-900 p-0.5">
          <button
            type="button"
            aria-label="Diminuir zoom"
            disabled={camera.zoom === 1}
            onClick={() => zoomTo(camera.zoom / 1.5)}
            className="rounded px-2 py-1 text-fog-500 transition hover:text-fog-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <button
            type="button"
            onClick={() => setCamera({ zoom: 1, x: 50, y: 50 })}
            className="rounded px-2 py-1 text-fog-300 transition hover:text-fog-100"
          >
            {Math.round(camera.zoom * 100)}%
          </button>
          <button
            type="button"
            aria-label="Aumentar zoom"
            disabled={camera.zoom === 4}
            onClick={() => zoomTo(camera.zoom * 1.5)}
            className="rounded px-2 py-1 text-fog-500 transition hover:text-fog-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            +
          </button>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-fog-500">
        {detailLabel} · {drawnPoints.length} áreas
        {metric === "presence" ? "" : " com registro"} ·{" "}
        borda <span style={{ color: GOOD }}>verde</span> = mais kills,{" "}
        <span style={{ color: EVEN }}>amarela</span> = empate,{" "}
        <span style={{ color: BAD }}>vermelha</span> = mais mortes
      </p>
      <div className="relative">
      <svg
        viewBox={`${camera.x - span / 2} ${camera.y - span / 2} ${span} ${span}`}
        role="img"
        aria-label={`Mapa de calor do lado ${side}`}
        onPointerDown={(event) => {
          event.currentTarget.setPointerCapture(event.pointerId);
          setDrag({ pointerId: event.pointerId, clientX: event.clientX, clientY: event.clientY, camera });
        }}
        onPointerMove={(event) => {
          if (!drag || event.pointerId !== drag.pointerId) return;
          const bounds = event.currentTarget.getBoundingClientRect();
          setCamera(
            clampCamera({
              zoom: drag.camera.zoom,
              x: drag.camera.x - ((event.clientX - drag.clientX) / bounds.width) * (100 / drag.camera.zoom),
              y: drag.camera.y - ((event.clientY - drag.clientY) / bounds.height) * (100 / drag.camera.zoom),
            }),
          );
        }}
        onPointerUp={(event) => {
          if (drag?.pointerId !== event.pointerId) return;
          event.currentTarget.releasePointerCapture(event.pointerId);
          setDrag(null);
        }}
        onPointerCancel={() => setDrag(null)}
        onPointerLeave={() => setHovered(null)}
        className={`mt-2 aspect-square w-full rounded-lg border border-ink-700 bg-ink-900 touch-none ${
          drag ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <image href={radar.image} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
        {mode === "gradient" ? (
          <>
            <defs>
              <radialGradient id={gradientId}>
                <stop offset="0%" stopColor={metric === "balance" ? GOOD : color} stopOpacity="0.55" />
                <stop offset="35%" stopColor={metric === "balance" ? GOOD : color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={metric === "balance" ? GOOD : color} stopOpacity="0" />
              </radialGradient>
              <radialGradient id={gradientBadId}>
                <stop offset="0%" stopColor={BAD} stopOpacity="0.55" />
                <stop offset="35%" stopColor={BAD} stopOpacity="0.22" />
                <stop offset="100%" stopColor={BAD} stopOpacity="0" />
              </radialGradient>
              <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.55" />
              </filter>
            </defs>
            {drawnPoints.map((point, index) => {
              const intensity = valueOf(point) / peak;
              return (
                <circle
                  key={`${point.x}|${point.y}|${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={(1.6 + intensity * 2.4) / camera.zoom}
                  fill={`url(#${metric === "balance" && netOf(point) < 0 ? gradientBadId : gradientId})`}
                  fillOpacity={0.35 + intensity * 0.45}
                  filter={`url(#${blurId})`}
                  onPointerEnter={() => setHovered(index)}
                />
              );
            })}
          </>
        ) : (
          drawnPoints.map((point, index) => {
            const intensity = valueOf(point) / peak;
            return (
              <circle
                key={`${point.x}|${point.y}|${index}`}
                cx={point.x}
                cy={point.y}
                r={(0.75 + intensity * 1.75) / camera.zoom}
                fill={colorOf(point)}
                fillOpacity={0.2 + intensity * 0.8}
                stroke={hovered === index ? "#e8ebf0" : edgeOf(point)}
                strokeWidth={hovered === index ? 0.45 : 0.3}
                onPointerEnter={() => setHovered(index)}
              />
            );
          })
        )}
      </svg>
      {tooltip}
      </div>
    </div>
  );
}
