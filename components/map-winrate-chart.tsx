import { mapLabel, pct } from "@/lib/format";
import { MapIcon } from "@/components/ui";

export interface MapWinrateRow {
  map: string;
  played: number;
  wins: number;
  losses: number;
  ties: number;
  winRate: number;
  ctRate: number;
  trRate: number;
  rounds: number;
}

export function MapWinrateChart({ rows }: { rows: MapWinrateRow[] }) {
  if (rows.length === 0) return null;

  const best = rows[0];

  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const above = row.winRate >= 0.5;
        const from = Math.min(row.winRate, 0.5) * 100;
        const size = Math.abs(row.winRate - 0.5) * 100;
        return (
          <div key={row.map} className="flex items-center gap-3">
            <div className="flex w-32 shrink-0 items-center gap-2 sm:w-40">
              <MapIcon map={row.map} className="size-5" />
              <span className="truncate text-sm font-medium">{mapLabel(row.map)}</span>
            </div>
            <div className="relative h-7 flex-1 overflow-hidden rounded-lg bg-ink-800/80">
              <div className="absolute inset-y-0 left-1/2 w-px bg-ink-600" />
              <div
                className={`absolute inset-y-1 rounded ${above ? "bg-win/80" : "bg-loss/80"}`}
                style={{ left: `${from}%`, width: `${Math.max(size, 0.4)}%` }}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-ct"
                style={{ left: `${row.ctRate * 100}%` }}
                title={`CT ${pct(row.ctRate)} dos rounds`}
              />
              <span
                className="absolute inset-y-0 w-0.5 bg-tr"
                style={{ left: `${row.trRate * 100}%` }}
                title={`TR ${pct(row.trRate)} dos rounds`}
              />
            </div>
            <div className="w-32 shrink-0 text-right sm:w-36">
              <span className={`tnum text-sm font-semibold ${above ? "text-win" : "text-loss"}`}>
                {pct(row.winRate)}
              </span>
              <span className="tnum ml-2 text-xs text-fog-500">
                {row.wins}–{row.losses}
                {row.ties ? `–${row.ties}` : ""}
              </span>
            </div>
          </div>
        );
      })}
      <p className="pt-1 text-[11px] text-fog-500">
        Barra a partir dos 50%: verde é saldo de vitórias, vermelho é saldo de derrotas. Os traços
        são rounds ganhos como <span className="text-ct">CT</span> e{" "}
        <span className="text-tr">TR</span>. O melhor é {mapLabel(best.map)} com{" "}
        {pct(best.winRate)} em {best.played} jogos.
      </p>
    </div>
  );
}
