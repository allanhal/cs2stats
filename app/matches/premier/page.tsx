import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import { Card, Empty, Pill, SectionTitle, Stat, Table, Td, Th } from "@/components/ui";
import { duration, num, pct } from "@/lib/format";
import { premierOwner, premierResult, summarizePremier } from "@/lib/premier";
import { listPremierScoreboards } from "@/lib/store";

export const dynamic = "force-dynamic";

const PAGE_SIZES = [25, 50, 100, 200];
const DEFAULT_PAGE_SIZE = 50;
const pagerLink =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-ink-700 px-2.5 text-fog-300 hover:border-win/40 hover:text-win";
const activePage =
  "inline-flex min-h-9 min-w-9 items-center justify-center rounded-md border border-win/30 bg-win/10 px-2.5 font-semibold text-win";

function pageHref(page: number, pageSize: number) {
  return `/matches/premier?pagina=${page}&porPagina=${pageSize}#lista-premier`;
}

function Pagination({
  page,
  pages,
  pageSize,
  position,
}: {
  page: number;
  pages: number;
  pageSize: number;
  position: "superior" | "inferior";
}) {
  if (pages <= 1) return null;

  const first = Math.min(Math.max(1, page - 2), Math.max(1, pages - 4));
  const last = Math.min(pages, first + 4);
  const visible = Array.from({ length: last - first + 1 }, (_, index) => first + index);
  const numbers = [...new Set([1, ...visible, pages])];

  return (
    <nav
      aria-label={`Paginação ${position} do Premier`}
      className="flex flex-wrap items-center gap-1.5 text-sm"
    >
      {page > 1 ? (
        <Link href={pageHref(page - 1, pageSize)} prefetch={false} rel="prev" className={pagerLink}>
          ← Anterior
        </Link>
      ) : null}
      {numbers.map((number, index) => (
        <span key={number} className="inline-flex items-center gap-1.5">
          {index > 0 && number - numbers[index - 1] > 1 ? (
            <span className="px-1 text-fog-500" aria-hidden>…</span>
          ) : null}
          {number === page ? (
            <span aria-current="page" aria-label={`Página ${number}`} className={activePage}>
              {number}
            </span>
          ) : (
            <Link
              href={pageHref(number, pageSize)}
              prefetch={false}
              aria-label={`Página ${number}`}
              className={pagerLink}
            >
              {number}
            </Link>
          )}
        </span>
      ))}
      {page < pages ? (
        <Link href={pageHref(page + 1, pageSize)} prefetch={false} rel="next" className={pagerLink}>
          Próxima →
        </Link>
      ) : null}
    </nav>
  );
}

export default async function PremierHistoryPage({ searchParams }: PageProps<"/matches/premier">) {
  const { pagina, porPagina } = await searchParams;
  const boards = await listPremierScoreboards();
  if (boards.length === 0) {
    return (
      <Empty
        title="Nenhum placar do Premier"
        body="O histórico aparece aqui quando os placares da Steam forem importados."
        cta={{ href: "/matches", label: "Ver partidas" }}
      />
    );
  }

  const requestedSize = typeof porPagina === "string" ? Number(porPagina) : DEFAULT_PAGE_SIZE;
  const pageSize = PAGE_SIZES.includes(requestedSize) ? requestedSize : DEFAULT_PAGE_SIZE;
  const pages = Math.ceil(boards.length / pageSize);
  const requested = typeof pagina === "string" ? Number(pagina) : 1;
  const page = Number.isSafeInteger(requested) ? Math.min(pages, Math.max(1, requested)) : 1;
  const offset = (page - 1) * pageSize;
  const end = Math.min(boards.length, offset + pageSize);
  const owner = premierOwner(boards[0]);
  const { overall, player, maps } = summarizePremier(boards);

  return (
    <Card>
      <SectionTitle
        title="Histórico Premier"
        hint={`${boards.length} placares da Steam · resultados na perspectiva de ${owner}`}
        action={
          <Link href="/matches" className="text-sm text-fog-300 hover:text-win">
            ← Demos analisadas
          </Link>
        }
      />
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat
          label="Aproveitamento"
          value={pct(overall.wins / overall.matches)}
          sub={`${overall.wins}V · ${overall.losses}D · ${overall.ties}E`}
        />
        <Stat
          label="Rounds ganhos"
          value={overall.roundsWon}
          sub={`${overall.roundsLost} perdidos`}
        />
        <Stat
          label={`K/D de ${owner}`}
          value={player.deaths > 0 ? num(player.kills / player.deaths) : "—"}
          sub={
            player.scoreboards > 0
              ? `${player.kills}K · ${player.assists}A · ${player.deaths}D`
              : undefined
          }
        />
        <Stat label={`MVPs de ${owner}`} value={player.mvps} />
      </div>
      <details className="mb-5 rounded-lg border border-ink-700 px-3 py-2.5 text-sm">
        <summary className="cursor-pointer font-medium text-fog-300 hover:text-win">
          Desempenho por mapa
        </summary>
        <div className="mt-3">
          <Table>
            <thead>
              <tr>
                <Th align="left">Mapa</Th>
                <Th>Jogos</Th>
                <Th title="Vitórias, derrotas e empates">V–D–E</Th>
                <Th>Vitórias</Th>
                <Th>Rounds</Th>
              </tr>
            </thead>
            <tbody>
              {maps.map(([map, totals]) => (
                <tr key={map}>
                  <Td align="left">{map}</Td>
                  <Td>{totals.matches}</Td>
                  <Td>{totals.wins}–{totals.losses}–{totals.ties}</Td>
                  <Td>{pct(totals.wins / totals.matches)}</Td>
                  <Td>{totals.roundsWon}–{totals.roundsLost}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
      </details>
      <div id="lista-premier" className="mb-3 flex scroll-mt-20 flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-fog-500">{offset + 1}–{end} de {boards.length} partidas</p>
        <nav aria-label="Quantidade de partidas por página" className="flex flex-wrap items-center gap-1.5 text-sm">
          <span className="mr-1 text-fog-500">Por página</span>
          {PAGE_SIZES.map((size) =>
            size === pageSize ? (
              <span key={size} aria-current="true" className={activePage}>
                {size}
              </span>
            ) : (
              <Link
                key={size}
                href={pageHref(Math.floor(offset / size) + 1, size)}
                prefetch={false}
                aria-label={`${size} partidas por página`}
                className={pagerLink}
              >
                {size}
              </Link>
            ),
          )}
        </nav>
      </div>
      <div className="mb-4">
        <Pagination page={page} pages={pages} pageSize={pageSize} position="superior" />
      </div>
      <Table>
        <thead>
          <tr>
            <Th align="left">Resultado</Th>
            <Th align="left">Mapa</Th>
            <Th>Placar</Th>
            <Th>Duração</Th>
            <Th align="left">Companheiros</Th>
            <Th align="left">Data</Th>
          </tr>
        </thead>
        <tbody>
          {boards.slice(offset, end).map((board) => {
            const result = premierResult(board);
            return (
              <tr key={board.id}>
                <Td align="left">
                  <Pill tone={result.tone}>{result.label}</Pill>
                </Td>
                <Td align="left" className="font-medium">
                <Link href={`/matches/premier/${board.id}`} prefetch={false} className="hover:text-win">
                    {board.map}
                  </Link>
                </Td>
                <Td>{result.score}–{result.opponent}</Td>
                <Td>{duration(board.durationSeconds)}</Td>
                <Td align="left" className="max-w-[300px] truncate text-xs text-fog-500">
                  {board.teams[board.ownerTeam].players
                    .filter(({ steamId }) => steamId !== board.ownerSteamId)
                    .map(({ name }) => name)
                    .join(", ")}
                </Td>
                <Td align="left" className="text-xs text-fog-500">
                  <LocalTime iso={board.playedAt} />
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
      <div className="mt-4">
        <Pagination page={page} pages={pages} pageSize={pageSize} position="inferior" />
      </div>
    </Card>
  );
}
