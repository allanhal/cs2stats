"use client";

import { useState, type ReactNode } from "react";
import { SectionTitle } from "@/components/ui";

type View = "radar" | "ranking";

const VIEWS: [View, string][] = [
  ["radar", "Radar do map pool"],
  ["ranking", "Ranking por aproveitamento"],
];

const HINT = "Aproveitamento em todos os mapas, do melhor para o pior";

export function MapWinrateTabs({
  radar,
  ranking,
  title = "Melhores mapas",
  anchor = "melhores-mapas",
}: {
  radar: ReactNode;
  ranking: ReactNode;
  title?: string;
  anchor?: string;
}) {
  const [view, setView] = useState<View>("radar");

  return (
    <>
      <SectionTitle
        id={anchor}
        title={title}
        hint={HINT}
        action={
          <div className="inline-flex shrink-0 rounded-lg border border-ink-700 p-0.5 text-xs">
            {VIEWS.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={view === value}
                onClick={() => setView(value)}
                className={`rounded-md px-2.5 py-1 transition-colors ${
                  view === value ? "bg-ink-800 text-fog-100" : "text-fog-500 hover:text-fog-100"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        }
      />
      <div className="flex min-h-[430px] flex-col justify-center">
        {view === "radar" ? radar : ranking}
      </div>
    </>
  );
}
