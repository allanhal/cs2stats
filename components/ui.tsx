import Link from "next/link";
import type { ReactNode } from "react";
import { mapLabel, pct } from "@/lib/format";
import { mapHeroFor, mapIconFor } from "@/lib/map-art";
import { MapBlendLayer } from "@/components/map-blend-backdrop";

export function Card({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section
      id={id}
      className={`scroll-mt-20 rounded-xl border border-ink-700/70 bg-ink-900/70 p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
  );
}

export function Hero({
  maps,
  children,
}: {
  maps?: string[];
  children: ReactNode;
}) {
  const art = maps?.filter((map) => mapHeroFor(map)) ?? [];

  return (
    <div className="relative -mx-4 overflow-hidden border-b border-ink-700/70 sm:mx-0 sm:rounded-xl sm:border">
      {art.length > 0 ? (
        <>
          <div
            aria-hidden
            className="absolute inset-y-0 right-0 w-full overflow-hidden sm:w-[72%]"
            style={{
              maskImage: "linear-gradient(to right, transparent 0%, black 38%)",
              WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 38%)",
            }}
          >
            <MapBlendLayer maps={art} opacity="opacity-100" />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-ink-950 via-ink-950/70 to-ink-950/10" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink-950/90 via-ink-950/15 to-ink-950/35" />
        </>
      ) : null}
      <div className="relative px-4 py-5 sm:px-6 sm:py-7">{children}</div>
    </div>
  );
}

export function anchorFor(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function SectionTitle({
  title,
  hint,
  action,
  id,
}: {
  title: string;
  hint?: string;
  action?: ReactNode;
  id?: string;
}) {
  const anchor = id ?? anchorFor(title);

  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <div>
        <h2 id={anchor} className="group scroll-mt-20 text-[15px] font-semibold tracking-tight">
          <a href={`#${anchor}`} className="inline-flex items-baseline gap-1.5">
            {title}
            <span
              aria-hidden
              className="text-fog-500 opacity-0 transition-opacity group-hover:opacity-100"
            >
              #
            </span>
          </a>
        </h2>
        {hint ? <p className="mt-0.5 text-xs text-fog-500">{hint}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  tone?: "neutral" | "win" | "loss" | "ct" | "tr";
}) {
  const color =
    tone === "win"
      ? "text-win"
      : tone === "loss"
        ? "text-loss"
        : tone === "ct"
          ? "text-ct"
          : tone === "tr"
            ? "text-tr"
            : "text-fog-100";
  const accent =
    tone === "win"
      ? "before:bg-win/70"
      : tone === "loss"
        ? "before:bg-loss/70"
        : tone === "ct"
          ? "before:bg-ct/70"
          : tone === "tr"
            ? "before:bg-tr/70"
            : "before:bg-ink-700";
  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-ink-700/70 bg-ink-900/70 px-4 py-3.5 before:absolute before:inset-y-0 before:left-0 before:w-0.5 ${accent}`}
    >
      <div className="text-[11px] font-medium uppercase tracking-wider text-fog-500">
        {label}
      </div>
      <div className={`tnum mt-1.5 text-[26px] leading-none font-semibold ${color}`}>
        {value}
      </div>
      {sub ? <div className="tnum mt-1.5 text-xs text-fog-500">{sub}</div> : null}
    </div>
  );
}

export function Meter({ value, tone = "auto" }: { value: number; tone?: "auto" | "neutral" }) {
  const clamped = Math.max(0, Math.min(1, value));
  const color =
    tone === "neutral"
      ? "bg-fog-500"
      : clamped >= 0.5
        ? "bg-win"
        : "bg-loss";
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700"
      role="img"
      aria-label={`${Math.round(clamped * 100)}%`}
    >
      <div className={`h-full rounded-full ${color}`} style={{ width: `${clamped * 100}%` }} />
    </div>
  );
}

export function ProgressBar({
  value,
  total,
  label,
}: {
  value: number;
  total: number;
  label: string;
}) {
  const share = total > 0 ? Math.min(value / total, 1) : 0;

  return (
    <div className="relative mt-1.5 h-5 w-full overflow-hidden rounded-md bg-ink-700 text-[11px] font-medium">
      <div
        className={`h-full ${share >= 0.5 ? "bg-win" : "bg-loss"}`}
        style={{ width: `${share * 100}%` }}
      />
      <div className="absolute inset-0 flex items-center justify-between gap-2 px-2">
        <span className={`tnum truncate ${share >= 0.3 ? "text-ink-950" : "text-fog-300"}`}>
          {value} de {total} {label}
        </span>
        <span className={`tnum shrink-0 ${share >= 0.92 ? "text-ink-950" : "text-fog-300"}`}>
          {pct(share)}
        </span>
      </div>
    </div>
  );
}

export function Pill({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "win" | "loss" | "ct" | "tr";
}) {
  const tones: Record<string, string> = {
    neutral: "bg-ink-700 text-fog-300",
    win: "bg-win/15 text-win",
    loss: "bg-loss/15 text-loss",
    ct: "bg-ct/15 text-ct",
    tr: "bg-tr/15 text-tr",
  };
  return (
    <span
      className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function Empty({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta?: { href: string; label: string };
}) {
  return (
    <Card className="text-center">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-fog-500">{body}</p>
      {cta ? (
        <Link
          href={cta.href}
          className="mt-4 inline-flex rounded-lg bg-win px-3.5 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
        >
          {cta.label}
        </Link>
      ) : null}
    </Card>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[640px] border-collapse text-sm">{children}</table>
    </div>
  );
}

export function Th({
  children,
  align = "right",
  title,
}: {
  children: ReactNode;
  align?: "left" | "right";
  title?: string;
}) {
  return (
    <th
      title={title}
      className={`whitespace-nowrap border-b border-ink-700 px-2 pb-2 text-[11px] font-medium uppercase tracking-wider text-fog-500 ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  );
}

export function Td({
  children,
  align = "right",
  className = "",
}: {
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={`tnum whitespace-nowrap border-b border-ink-700/50 px-2 py-2.5 ${
        align === "left" ? "text-left" : "text-right"
      } ${className}`}
    >
      {children}
    </td>
  );
}

export function Avatar({ src, name, className = "size-6" }: {
  src?: string;
  name: string;
  className?: string;
}) {
  if (src) {
    return <img src={src} alt="" className={`shrink-0 rounded ${className}`} loading="lazy" />;
  }
  return (
    <div
      className={`grid shrink-0 place-items-center rounded bg-ink-800 text-[10px] font-semibold text-fog-500 ${className}`}
    >
      {name.trim().charAt(0).toUpperCase() || "?"}
    </div>
  );
}

export function PlayerTag({ name, avatar, size }: {
  name: string;
  avatar?: string;
  size?: string;
}) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <Avatar src={avatar} name={name} className={size} />
      <span className="truncate">{name}</span>
    </span>
  );
}

const MAP_CODES: Record<string, string> = {
  de_dust2: "D2",
  de_mirage: "MR",
  de_inferno: "IN",
  de_nuke: "NK",
  de_overpass: "OP",
  de_ancient: "AN",
  de_anubis: "AB",
  de_vertigo: "VT",
  de_train: "TN",
  de_cache: "CH",
  de_basalt: "BS",
  de_brewery: "BW",
  de_dogtown: "DG",
  de_edin: "ED",
  de_grail: "GL",
  de_jura: "JU",
  de_palais: "PL",
  de_whistle: "WH",
  cs_agency: "AG",
  cs_italy: "IT",
  cs_office: "OF",
};

function mapCode(map: string): string {
  const known = MAP_CODES[map];
  if (known) return known;
  const name = mapLabel(map).replace(/[^A-Za-z0-9]/g, "");
  return (name.slice(0, 2) || "?").toUpperCase();
}

const GOLDEN_ANGLE = 137.508;

function mapHue(map: string): number {
  const known = Object.keys(MAP_CODES).indexOf(map);
  if (known >= 0) return Math.round((known * GOLDEN_ANGLE) % 360);
  let hash = 0;
  for (const char of map) hash = (hash * 31 + char.charCodeAt(0)) % 360;
  return hash;
}

export function MapIcon({ map, className = "size-6" }: { map: string; className?: string }) {
  const icon = mapIconFor(map);
  if (icon) {
    return (
      <img
        src={icon}
        alt=""
        title={mapLabel(map)}
        loading="lazy"
        className={`shrink-0 object-contain ${className}`}
      />
    );
  }

  const hue = mapHue(map);
  return (
    <span
      aria-hidden
      title={mapLabel(map)}
      className={`grid shrink-0 place-items-center rounded text-[10px] font-semibold leading-none ${className}`}
      style={{
        backgroundColor: `hsl(${hue} 42% 21%)`,
        color: `hsl(${hue} 72% 74%)`,
        boxShadow: `inset 0 0 0 1px hsl(${hue} 40% 32%)`,
      }}
    >
      {mapCode(map)}
    </span>
  );
}

export function MapTag({ map, size }: { map: string; size?: string }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <MapIcon map={map} className={size} />
      <span className="truncate">{mapLabel(map)}</span>
    </span>
  );
}
