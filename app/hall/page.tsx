import Link from "next/link";
import { Avatar, Card, Empty, Pill, SectionTitle } from "@/components/ui";
import { aggregatePlayers, awards, type Award, type AwardMode } from "@/lib/aggregate";
import { loadDataset } from "@/lib/data";
import type { Profiles } from "@/lib/profiles";

export const dynamic = "force-dynamic";

export default async function HallPage({ searchParams }: PageProps<"/hall">) {
  const { views, tracked, config, profiles } = await loadDataset();

  const mode: AwardMode = (await searchParams).modo === "total" ? "total" : "round";

  if (views.length === 0) {
    return (
      <Empty
        title="Nada pra zoar ainda"
        body="Depois da primeira demo aparece quem cegou os amigos, quem deu dano em aliado e quem carregou o time."
        cta={{ href: "/upload", label: "Enviar uma demo" }}
      />
    );
  }

  const players = aggregatePlayers(views, { tracked, onlyOurTeam: true });
  const all = awards(players, mode);
  const fame = all.filter((a) => a.tone === "fame");
  const shame = all.filter((a) => a.tone === "shame");

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Hall da fama e da vergonha</h1>
        <p className="mt-1 text-sm text-fog-500">
          {views.filter((v) => v.ourSquad).length} partidas de {config.teamName}.{" "}
          {mode === "round"
            ? "Cada número dividido pelos rounds jogados, para não premiar só quem apareceu mais."
            : "Tudo somado, sem dividir pelos rounds jogados."}
        </p>
        <div className="mt-3 inline-flex rounded-lg border border-ink-700 p-0.5 text-xs">
          <ModeTab href="/hall" label="Por round" active={mode === "round"} />
          <ModeTab href="/hall?modo=total" label="Total" active={mode === "total"} />
        </div>
      </div>

      <section>
        <SectionTitle title="Hall da vergonha" hint="Os números que ninguém quer no currículo" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {shame.map((award) => (
            <AwardCard key={award.id} award={award} profiles={profiles} />
          ))}
        </div>
      </section>

      <section>
        <SectionTitle title="Hall da fama" hint="Crédito onde é devido" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {fame.map((award) => (
            <AwardCard key={award.id} award={award} profiles={profiles} />
          ))}
        </div>
      </section>
    </div>
  );
}

function ModeTab({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link
      href={href}
      className={`rounded-md px-2.5 py-1 transition-colors ${
        active ? "bg-ink-800 text-fog-100" : "text-fog-500 hover:text-fog-100"
      }`}
    >
      {label}
    </Link>
  );
}

function AwardCard({ award, profiles }: { award: Award; profiles: Profiles }) {
  const leader = award.leader!;
  const runnersUp = award.board.slice(1, 4);
  const shame = award.tone === "shame";

  return (
    <Card className={shame ? "border-loss/25" : "border-win/25"}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{award.title}</h3>
          <p className="mt-0.5 text-[11px] text-fog-500">{award.hint}</p>
        </div>
        <Pill tone={shame ? "loss" : "win"}>{shame ? "vergonha" : "fama"}</Pill>
      </div>

      <Link
        href={`/players/${leader.steamId}`}
        className="mt-3 block rounded-lg bg-ink-850/70 px-3 py-2.5 transition-colors hover:bg-ink-800"
      >
        <div className="flex min-w-0 items-center gap-2">
          <Avatar src={profiles[leader.steamId]?.avatar} name={leader.name} className="size-7" />
          <span className="truncate text-base font-semibold">{leader.name}</span>
        </div>
        <div className="tnum mt-0.5 text-xs text-fog-500">{leader.label}</div>
      </Link>

      {runnersUp.length > 0 ? (
        <ol className="mt-2.5 space-y-1">
          {runnersUp.map((entry, index) => (
            <li key={entry.steamId} className="flex items-center gap-2 text-xs">
              <span className="tnum w-3 text-fog-500">{index + 2}</span>
              <Link
                href={`/players/${entry.steamId}`}
                className="flex min-w-0 flex-1 items-center gap-1.5 text-fog-300 hover:text-fog-100"
              >
                <Avatar
                  src={profiles[entry.steamId]?.avatar}
                  name={entry.name}
                  className="size-4"
                />
                <span className="truncate">{entry.name}</span>
              </Link>
              <span className="tnum text-fog-500">{entry.label}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </Card>
  );
}
