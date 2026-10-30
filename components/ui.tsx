import Link from "next/link";
import type { ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-ink-700/70 bg-ink-900/70 p-4 sm:p-5 ${className}`}
    >
      {children}
    </section>
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
  tone?: "neutral" | "win" | "loss";
}) {
  const color =
    tone === "win" ? "text-win" : tone === "loss" ? "text-loss" : "text-fog-100";
  return (
    <div className="rounded-xl border border-ink-700/70 bg-ink-900/70 px-4 py-3.5">
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
