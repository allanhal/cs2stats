import { mkdir, rm, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { extractMatch } from "../lib/extract";
import { archiveDemo, archivedDemos } from "../lib/demo-archive";
import { downloadTo, fingerprintOfFile, sendRecord } from "../lib/demo-intake";
import { requireEnv } from "../lib/env";
import {
  GcAuthError,
  currentMonth,
  demoUrl,
  listAvailableMonths,
  listEveryMatch,
  pause,
  type GcMatch,
} from "../lib/gamersclub";

interface SweepOptions {
  backfill: boolean;
  dryRun: boolean;
  limit: number;
}

interface AgentState {
  archived?: Record<string, string>;
  done: Record<string, { matchId: string; at: string }>;
  gone: Record<string, string>;
  failed: Record<string, { at: string; error: string }>;
}

const STATE_FILE = process.env.GC_STATE_FILE ?? join(process.cwd(), ".gc-agent-state.json");
const WORK_DIR = process.env.GC_WORK_DIR ?? join(tmpdir(), "cs2stats-gc");
const SWEEP_MIN_MS = Number(process.env.GC_SWEEP_MIN_MS ?? 20 * 60 * 1000);
const SWEEP_MAX_MS = Number(process.env.GC_SWEEP_MAX_MS ?? 90 * 60 * 1000);
const DOWNLOAD_MIN_MS = Number(process.env.GC_DOWNLOAD_MIN_MS ?? 4 * 60 * 1000);
const DOWNLOAD_MAX_MS = Number(process.env.GC_DOWNLOAD_MAX_MS ?? 20 * 60 * 1000);

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

async function loadState(): Promise<AgentState> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as AgentState;
  } catch {
    return { done: {}, gone: {}, failed: {} };
  }
}

async function saveState(state: AgentState): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

async function alreadyStored(matches: GcMatch[]): Promise<Set<string>> {
  if (matches.length === 0) return new Set();
  const site = requireEnv("CS2STATS_URL").replace(/\/$/, "");
  const response = await fetch(`${site}/api/upload/known`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ matchIds: matches.map((match) => match.id) }),
  });
  if (!response.ok) {
    log(`aviso: /api/upload/known respondeu ${response.status}; vou baixar sem essa checagem`);
    return new Set();
  }
  const body = (await response.json().catch(() => ({}))) as {
    known?: Record<string, { outdated: boolean }>;
  };
  const skip = new Set<string>();
  for (const [id, entry] of Object.entries(body.known ?? {})) {
    if (!entry.outdated) skip.add(id);
  }
  return skip;
}

async function ingest(match: GcMatch, state: AgentState, dryRun: boolean): Promise<void> {
  const url = await demoUrl(match.id);
  if (!url) {
    state.gone[match.id] = new Date().toISOString();
    log(`sem demo: ${match.id} ${match.map} ${match.playedAt.slice(0, 10)}`);
    return;
  }

  const fileName = url.split("/").pop() ?? `${match.id}.dem`;
  const target = join(WORK_DIR, fileName);
  try {
    const bytes = await downloadTo(url, target);
    log(`baixou ${fileName} (${(bytes / 1024 / 1024).toFixed(0)} MB)`);
    const record = extractMatch(target, { fileName, uploadedBy: "gamersclub" });
    if (dryRun) {
      log(`simulado: ${record.map} ${record.score.A}-${record.score.B} · ${record.players.length} jogadores · versão ${record.version}`);
      return;
    }
    const result = await sendRecord(record, await fingerprintOfFile(target));
    const archived = await archiveDemo(target);
    (state.archived ??= {})[match.id] = new Date().toISOString();
    log(`acervo: ${fileName} ${archived === "existing" ? "ja existe" : "enviada"}`);
    state.done[match.id] = { matchId: result, at: new Date().toISOString() };
    log(`${result}: ${record.map} ${record.score.A}-${record.score.B}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("indisponível")) {
      state.gone[match.id] = new Date().toISOString();
      log(`expirou no servidor da GC: ${match.id}`);
    } else {
      state.failed[match.id] = { at: new Date().toISOString(), error: message };
      log(`falhou ${match.id}: ${message}`);
    }
  } finally {
    await rm(target, { force: true });
  }
}

function pending(matches: GcMatch[], state: AgentState): GcMatch[] {
  return matches
    .filter((match) => match.game === "cs2")
    .filter((match) => (!state.done[match.id] || !state.archived?.[match.id]) && !state.gone[match.id])
    .sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

function previousMonth(): string {
  const now = new Date();
  const earlier = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
  return `${earlier.getUTCFullYear()}-${String(earlier.getUTCMonth() + 1).padStart(2, "0")}`;
}

async function monthsToSweep(backfill: boolean): Promise<string[]> {
  if (!backfill) return [currentMonth(), previousMonth()];
  const months = await listAvailableMonths();
  return months.sort((a, b) => b.localeCompare(a));
}

async function buildQueue(options: SweepOptions, state: AgentState): Promise<GcMatch[]> {
  const queue: GcMatch[] = [];
  const files = await archivedDemos();
  state.archived ??= {};
  for (const month of await monthsToSweep(options.backfill)) {
    const candidates = pending(await listEveryMatch(month), state);
    const stored = await alreadyStored(candidates);
    let skipped = 0;
    for (const match of candidates) {
      const archived = files.some((file) => file.name.includes(`__${match.id}__`));
      if (archived) state.archived[match.id] = new Date().toISOString();
      if (stored.has(match.id) && archived) {
        state.done[match.id] = { matchId: "enviada pelo script", at: new Date().toISOString() };
        skipped += 1;
        continue;
      }
      queue.push(match);
    }
    if (skipped > 0) {
      await saveState(state);
      log(`${month}: ${skipped} ja no banco, sem download`);
    }
    await pause(1500, 3500);
  }
  return queue.sort((a, b) => b.playedAt.localeCompare(a.playedAt));
}

async function sweep(options: SweepOptions, state: AgentState): Promise<number> {
  let processed = 0;
  let announced = -1;
  while (processed < options.limit) {
    const queue = await buildQueue(options, state);
    if (queue.length === 0) break;
    if (queue.length !== announced) {
      log(`${queue.length} partida(s) pendente(s); a mais recente e de ${queue[0].playedAt.slice(0, 16)}`);
      announced = queue.length;
    }
    await ingest(queue[0], state, options.dryRun);
    await saveState(state);
    processed += 1;
    if (processed < options.limit) await pause(DOWNLOAD_MIN_MS, DOWNLOAD_MAX_MS);
  }
  return processed;
}

async function main() {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const found = args.find((arg) => arg.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : null;
  };
  const options: SweepOptions = {
    backfill: args.includes("--backfill"),
    dryRun: args.includes("--dry-run"),
    limit: Number(flag("--limit") ?? Number.MAX_SAFE_INTEGER),
  };
  const once = args.includes("--once");

  await mkdir(WORK_DIR, { recursive: true });
  const state = await loadState();
  log(`estado: ${Object.keys(state.done).length} prontas, ${Object.keys(state.gone).length} sem demo`);

  for (;;) {
    try {
      const processed = await sweep(options, state);
      await saveState(state);
      log(`varredura terminou, ${processed} processada(s)`);
    } catch (error) {
      if (error instanceof GcAuthError) {
        console.error(`${error.message}\nRenove GAMERSCLUB_COOKIE e rode de novo.`);
        process.exit(2);
      }
      log(`erro na varredura: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (once) break;
    await pause(SWEEP_MIN_MS, SWEEP_MAX_MS);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
