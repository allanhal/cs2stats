import { Avatar, Card, Empty, Pill, SectionTitle } from "@/components/ui";
import { aggregatePlayers, averagePlayer, type PlayerAggregate } from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import { num, pct } from "@/lib/format";
import type { Profiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";

const OPPONENTS_ID = "adversarios";

type Metric = {
  label: string;
  hint?: string;
  value: (p: PlayerAggregate) => number;
  format: (value: number) => string;
  lowerIsBetter?: boolean;
};

const METRICS: Metric[] = [
  { label: "Rating", value: (p) => p.rating, format: (v) => num(v) },
  { label: "K/D", value: (p) => p.kd, format: (v) => num(v) },
  {
    label: "KPR",
    hint: "Kills por round",
    value: (p) => p.kpr,
    format: (v) => num(v),
  },
  {
    label: "DPR",
    hint: "Mortes por round",
    value: (p) => p.dpr,
    format: (v) => num(v),
    lowerIsBetter: true,
  },
  { label: "ADR", value: (p) => p.adr, format: (v) => v.toFixed(0) },
  { label: "KAST", value: (p) => p.kast, format: (v) => pct(v) },
  { label: "HS%", value: (p) => p.hsPercent, format: (v) => pct(v) },
  { label: "Vitórias", value: (p) => p.winRate, format: (v) => pct(v) },
  {
    label: "Entradas ganhas",
    hint: "Entry kills sobre o total de duelos de abertura",
    value: (p) =>
      p.openingKills + p.openingDeaths > 0
        ? p.openingKills / (p.openingKills + p.openingDeaths)
        : 0,
    format: (v) => pct(v),
  },
  {
    label: "Round após abrir",
    hint: "Rounds ganhos depois de fazer a primeira kill",
    value: (p) => p.openingWinRate,
    format: (v) => pct(v),
  },
  { label: "Clutches", value: (p) => p.clutchRate, format: (v) => pct(v) },
  {
    label: "Trades por round",
    value: (p) => p.tradeKills / Math.max(p.rounds, 1),
    format: (v) => num(v),
  },
  {
    label: "Dano de utilitário",
    hint: "Por round",
    value: (p) => p.utilityDamage / Math.max(p.rounds, 1),
    format: (v) => num(v, 1),
  },
  {
    label: "Multi-kills",
    hint: "3k, 4k e ace por round",
    value: (p) => (p.multiKills.k3 + p.multiKills.k4 + p.multiKills.k5) / Math.max(p.rounds, 1),
    format: (v) => num(v, 3),
  },
  {
    label: "Rounds sem kill",
    value: (p) => p.zeroKillRounds / Math.max(p.rounds, 1),
    format: (v) => pct(v),
    lowerIsBetter: true,
  },
];

export default async function ComparePage({ searchParams }: PageProps<"/comparar">) {
  const { views, tracked, profiles } = await loadDataset();

  if (views.length === 0) {
    return (
      <Empty
        title="Nada para comparar"
        body="Assim que a primeira demo entrar dá para colocar dois jogadores lado a lado."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const everyone = aggregatePlayers(views).sort((x, y) => y.rounds - x.rounds);
  const friends = everyone.filter((p) => tracked.has(p.steamId));
  const strangers = everyone.filter((p) => !tracked.has(p.steamId));
  const opponents = averagePlayer(strangers, OPPONENTS_ID, "Média dos adversários");
  const ranked = opponents ? [...friends, opponents] : friends;

  const query = await searchParams;
  const pick = (raw: string | string[] | undefined, fallback: PlayerAggregate | undefined) => {
    const id = Array.isArray(raw) ? raw[0] : raw;
    return ranked.find((p) => p.steamId === id) ?? fallback;
  };
  const left = pick(query.a, ranked[0]);
  const right = pick(query.b, ranked.find((p) => p.steamId !== left?.steamId) ?? ranked[1]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Comparador</h1>
        <p className="mt-1 text-sm text-fog-500">
          Dois jogadores lado a lado, com tudo o que as demos acumularam até agora.
        </p>
      </div>

      <Card>
        <form action="/comparar" method="get" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
          <PlayerSelect name="a" label="Jogador 1" players={ranked} selected={left?.steamId} />
          <PlayerSelect name="b" label="Jogador 2" players={ranked} selected={right?.steamId} />
          <button
            type="submit"
            className="self-end rounded-lg bg-win px-4 py-2 text-sm font-semibold text-ink-950 transition-opacity hover:opacity-90"
          >
            Comparar
          </button>
        </form>
      </Card>

      {left && right && left.steamId !== right.steamId ? (
        <Comparison
          left={left}
          right={right}
          profiles={profiles}
          views={views}
          opponentCount={strangers.length}
        />
      ) : (
        <Card>
          <p className="text-sm text-fog-500">Escolha dois jogadores diferentes.</p>
        </Card>
      )}
    </div>
  );
}

function PlayerSelect({
  name,
  label,
  players,
  selected,
}: {
  name: string;
  label: string;
  players: PlayerAggregate[];
  selected?: string;
}) {
  return (
    <label className="block">
      <span className="text-[11px] uppercase tracking-wider text-fog-500">{label}</span>
      <select
        name={name}
        defaultValue={selected}
        className="mt-1 w-full rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-sm text-fog-100"
      >
        {players.map((p) => (
          <option key={p.steamId} value={p.steamId}>
            {p.steamId === OPPONENTS_ID
              ? p.name
              : `${p.name} · ${p.matches} partida${p.matches === 1 ? "" : "s"}`}
          </option>
        ))}
      </select>
    </label>
  );
}

function Comparison({
  left,
  right,
  profiles,
  views,
  opponentCount,
}: {
  left: PlayerAggregate;
  right: PlayerAggregate;
  profiles: Profiles;
  views: Awaited<ReturnType<typeof loadDataset>>["views"];
  opponentCount: number;
}) {
  const synthetic = left.steamId === OPPONENTS_ID || right.steamId === OPPONENTS_ID;
  const shared = { together: 0, togetherWins: 0, against: 0, leftWins: 0 };
  for (const v of synthetic ? [] : views) {
    const a = v.match.players.find((p) => p.steamId === left.steamId);
    const b = v.match.players.find((p) => p.steamId === right.steamId);
    if (!a || !b) continue;
    const aWon = v.ourSquad === a.squad ? v.result === "win" : v.result === "loss";
    if (a.squad === b.squad) {
      shared.together += 1;
      if (aWon) shared.togetherWins += 1;
    } else {
      shared.against += 1;
      if (aWon) shared.leftWins += 1;
    }
  }

  const wins = METRICS.reduce(
    (acc, metric) => {
      const a = metric.value(left);
      const b = metric.value(right);
      if (a === b) return acc;
      const leftBetter = metric.lowerIsBetter ? a < b : a > b;
      return leftBetter ? { ...acc, left: acc.left + 1 } : { ...acc, right: acc.right + 1 };
    },
    { left: 0, right: 0 },
  );

  return (
    <>
      <Card>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <PlayerHead
            player={left}
            avatar={profiles[left.steamId]?.avatar}
            wins={wins.left}
            opponentCount={opponentCount}
          />
          <span className="text-xs uppercase tracking-wider text-fog-500">vs</span>
          <PlayerHead
            player={right}
            avatar={profiles[right.steamId]?.avatar}
            wins={wins.right}
            opponentCount={opponentCount}
            align="right"
          />
        </div>
      </Card>

      <Card>
        <SectionTitle
          title="Números lado a lado"
          hint="A barra de cada um é proporcional ao maior valor da linha"
        />
        <div className="space-y-3">
          {METRICS.map((metric) => {
            const a = metric.value(left);
            const b = metric.value(right);
            const max = Math.max(a, b, 0.0001);
            const leftLeads = a !== b && (metric.lowerIsBetter ? a < b : a > b);
            const rightLeads = a !== b && (metric.lowerIsBetter ? b < a : b > a);
            return (
              <div key={metric.label}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span
                    className={`tnum w-20 ${leftLeads ? "font-semibold text-win" : "text-fog-300"}`}
                  >
                    {metric.format(a)}
                  </span>
                  <span
                    title={metric.hint}
                    className="text-center text-[11px] uppercase tracking-wider text-fog-500"
                  >
                    {metric.label}
                  </span>
                  <span
                    className={`tnum w-20 text-right ${rightLeads ? "font-semibold text-win" : "text-fog-300"}`}
                  >
                    {metric.format(b)}
                  </span>
                </div>
                <div className="mt-1 flex gap-1">
                  <div className="flex h-1.5 flex-1 justify-end overflow-hidden rounded-full bg-ink-700/70">
                    <div
                      className={`h-full rounded-full ${leftLeads ? "bg-win" : "bg-fog-500"}`}
                      style={{ width: `${(a / max) * 100}%` }}
                    />
                  </div>
                  <div className="flex h-1.5 flex-1 overflow-hidden rounded-full bg-ink-700/70">
                    <div
                      className={`h-full rounded-full ${rightLeads ? "bg-win" : "bg-fog-500"}`}
                      style={{ width: `${(b / max) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {!synthetic && shared.together + shared.against > 0 ? (
        <Card>
          <SectionTitle title="Quando os dois estão na mesma demo" />
          <div className="grid gap-3 sm:grid-cols-2">
            {shared.together > 0 ? (
              <div className="rounded-lg border border-ink-700/70 bg-ink-850/40 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fog-500">
                  Do mesmo lado
                </div>
                <div className="tnum mt-1 text-lg font-semibold">
                  {shared.together} partida{shared.together === 1 ? "" : "s"}
                </div>
                <div className="tnum mt-0.5 text-xs text-fog-500">
                  {shared.togetherWins} vitórias ·{" "}
                  {pct(shared.togetherWins / Math.max(shared.together, 1))}
                </div>
              </div>
            ) : null}
            {shared.against > 0 ? (
              <div className="rounded-lg border border-ink-700/70 bg-ink-850/40 px-3 py-3">
                <div className="text-[11px] uppercase tracking-wider text-fog-500">
                  Um contra o outro
                </div>
                <div className="tnum mt-1 text-lg font-semibold">
                  {shared.against} partida{shared.against === 1 ? "" : "s"}
                </div>
                <div className="tnum mt-0.5 text-xs text-fog-500">
                  {left.name} {shared.leftWins}–{shared.against - shared.leftWins} {right.name}
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      ) : null}
    </>
  );
}

function PlayerHead({
  player,
  avatar,
  wins,
  opponentCount,
  align = "left",
}: {
  player: PlayerAggregate;
  avatar?: string;
  wins: number;
  opponentCount: number;
  align?: "left" | "right";
}) {
  const average = player.steamId === OPPONENTS_ID;

  return (
    <div className={align === "right" ? "text-right" : ""}>
      <div className={`flex items-center gap-2 ${align === "right" ? "justify-end" : ""}`}>
        <Avatar src={avatar} name={player.name} className="size-7" />
        {average ? (
          <span className="font-semibold">{player.name}</span>
        ) : (
          <a href={`/players/${player.steamId}`} className="font-semibold hover:text-win">
            {player.name}
          </a>
        )}
      </div>
      <div className="tnum mt-1 text-xs text-fog-500">
        {average
          ? `${opponentCount} jogadores de fora do grupo · ${player.rounds.toFixed(0)} rounds cada`
          : `${player.matches} partidas · ${player.rounds} rounds · ${player.wins}V–${player.losses}D`}
      </div>
      <div className={`mt-2 ${align === "right" ? "flex justify-end" : ""}`}>
        <Pill tone={wins > 0 ? "win" : "neutral"}>
          {wins} de {METRICS.length} métricas
        </Pill>
      </div>
    </div>
  );
}
