"use client";

import { useMemo, useState } from "react";

type RouteHeatmapProps = {
  id: string;
  side: "CT" | "T";
  radar: { image: string };
  points: { x: number; y: number; seconds: number }[];
};

export function RouteHeatmap({ id, side, radar, points }: RouteHeatmapProps) {
  const [mode, setMode] = useState<"points" | "gradient">("points");
  const [camera, setCamera] = useState({ zoom: 1, x: 50, y: 50 });
  const [drag, setDrag] = useState<{
    pointerId: number;
    clientX: number;
    clientY: number;
    camera: { zoom: number; x: number; y: number };
  } | null>(null);
  const bucketSize = camera.zoom < 1.5 ? 12 : camera.zoom < 2.25 ? 7 : camera.zoom < 3 ? 3.5 : 1;
  const visiblePoints = useMemo(() => {
    const buckets = new Map<string, { seconds: number; weightedX: number; weightedY: number }>();
    for (const point of points) {
      const key = `${Math.floor(point.x / bucketSize)}|${Math.floor(point.y / bucketSize)}`;
      const bucket = buckets.get(key) ?? { seconds: 0, weightedX: 0, weightedY: 0 };
      bucket.seconds += point.seconds;
      bucket.weightedX += point.x * point.seconds;
      bucket.weightedY += point.y * point.seconds;
      buckets.set(key, bucket);
    }
    return Array.from(buckets.values()).map((bucket) => ({
      seconds: bucket.seconds,
      x: bucket.weightedX / bucket.seconds,
      y: bucket.weightedY / bucket.seconds,
    }));
  }, [bucketSize, points]);
  const peak = Math.max(...visiblePoints.map((point) => point.seconds), 1);
  const color = side === "CT" ? "#5aa9f5" : "#e8b23a";
  const gradientId = `heat-gradient-${id}`;
  const blurId = `heat-blur-${id}`;
  const span = 100 / camera.zoom;
  const detailLabel = bucketSize === 1 ? "Detalhe máximo" : bucketSize <= 3.5 ? "Detalhe" : "Visão geral";

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

  return (
    <div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px]">
        <div className="inline-flex rounded-md border border-ink-700 bg-ink-900 p-0.5">
          {([
            ["points", "Pontos"],
            ["gradient", "Gradiente"],
          ] as const).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded px-2 py-1 transition ${
                mode === value ? "bg-ink-700 text-fog-100" : "text-fog-500 hover:text-fog-200"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
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
        {detailLabel} · {visiblePoints.length} áreas
      </p>
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
        className={`mt-2 aspect-square w-full rounded-lg border border-ink-700 bg-ink-900 touch-none ${
          drag ? "cursor-grabbing" : "cursor-grab"
        }`}
      >
        <image href={radar.image} width="100" height="100" preserveAspectRatio="xMidYMid meet" />
        {mode === "gradient" ? (
          <>
            <defs>
              <radialGradient id={gradientId}>
                <stop offset="0%" stopColor={color} stopOpacity="0.55" />
                <stop offset="35%" stopColor={color} stopOpacity="0.22" />
                <stop offset="100%" stopColor={color} stopOpacity="0" />
              </radialGradient>
              <filter id={blurId} x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="0.55" />
              </filter>
            </defs>
            {visiblePoints.map((point, index) => {
              const intensity = point.seconds / peak;
              return (
                <circle
                  key={`${point.x}|${point.y}|${index}`}
                  cx={point.x}
                  cy={point.y}
                  r={(1.6 + intensity * 2.4) / camera.zoom}
                  fill={`url(#${gradientId})`}
                  fillOpacity={0.35 + intensity * 0.45}
                  filter={`url(#${blurId})`}
                />
              );
            })}
          </>
        ) : (
          visiblePoints.map((point, index) => {
            const intensity = point.seconds / peak;
            return (
              <circle
                key={`${point.x}|${point.y}|${index}`}
                cx={point.x}
                cy={point.y}
                r={(0.75 + intensity * 1.75) / camera.zoom}
                fill={color}
                fillOpacity={0.2 + intensity * 0.8}
                stroke="#08090c"
                strokeWidth="0.25"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
