import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { extractMatch } from "../lib/extract";
import { archiveDemo } from "../lib/demo-archive";
import { downloadTo, fingerprintOfFile, pause, sendRecord } from "../lib/demo-intake";
import { requireEnv } from "../lib/env";
import { MatchmakingSession, SteamChainError, collectShareCodes } from "../lib/steam-mm";
import { unpackDemo } from "../lib/unpack";

interface PlayerConfig {
  nick: string;
  steamId: string;
  authCode: string;
  shareCode: string;
}

interface AgentConfig {
  steamApiKey: string;
  bot: { username: string; password: string; sharedSecret?: string };
  players: PlayerConfig[];
}

interface AgentState {
  pending?: Record<string, string>;
  cursors: Record<string, string>;
  done: Record<string, { matchId: string; at: string }>;
  gone: Record<string, string>;
}

const STATE_FILE = process.env.MM_STATE_FILE ?? join(process.cwd(), ".mm-agent-state.json");
const WORK_DIR = process.env.MM_WORK_DIR ?? join(tmpdir(), "cs2stats-mm");
const SWEEP_MIN_MS = Number(process.env.MM_SWEEP_MIN_MS ?? 30 * 60 * 1000);
const SWEEP_MAX_MS = Number(process.env.MM_SWEEP_MAX_MS ?? 120 * 60 * 1000);
const DOWNLOAD_MIN_MS = Number(process.env.MM_DOWNLOAD_MIN_MS ?? 60 * 1000);
const DOWNLOAD_MAX_MS = Number(process.env.MM_DOWNLOAD_MAX_MS ?? 5 * 60 * 1000);
const MAX_CHAIN = Number(process.env.MM_MAX_CHAIN ?? 25);

const log = (message: string) => console.log(`${new Date().toISOString()} ${message}`);

function loadConfig(): AgentConfig {
  const players: PlayerConfig[] = process.env.MM_PLAYERS
    ? JSON.parse(requireEnv("MM_PLAYERS"))
    : [{
        nick: process.env.STEAM_MATCH_NICK ?? requireEnv("STEAM_MATCH_STEAM_ID"),
        steamId: requireEnv("STEAM_MATCH_STEAM_ID"),
        authCode: requireEnv("STEAM_MATCH_AUTH_CODE"),
        shareCode: requireEnv("STEAM_MATCH_SHARE_CODE"),
      }];
  if (
    !Array.isArray(players) ||
    players.length === 0 ||
    players.some((player) =>
      !player || typeof player.nick !== "string" ||
      typeof player.steamId !== "string" || !/^\d{17}$/.test(player.steamId) ||
      typeof player.authCode !== "string" || !player.authCode ||
      typeof player.shareCode !== "string" || !/^CSGO(?:-[A-Za-z0-9]{5}){5}$/.test(player.shareCode)
    )
  ) {
    throw new Error("configuracao de jogadores do matchmaking invalida");
  }
  return {
    steamApiKey: requireEnv("STEAM_API_KEY"),
    bot: {
      username: requireEnv("STEAM_BOT_USERNAME"),
      password: requireEnv("STEAM_BOT_PASSWORD"),
      sharedSecret: process.env.STEAM_BOT_SHARED_SECRET
        ? requireEnv("STEAM_BOT_SHARED_SECRET")
        : undefined,
    },
    players,
  };
}

async function loadState(): Promise<AgentState> {
  try {
    return JSON.parse(await readFile(STATE_FILE, "utf8")) as AgentState;
  } catch {
    return { cursors: {}, done: {}, gone: {} };
  }
}

async function saveState(state: AgentState): Promise<void> {
  await writeFile(STATE_FILE, `${JSON.stringify(state, null, 2)}\n`);
}

async function ingest(shareCode: string, url: string, state: AgentState): Promise<void> {
  const fileName = basename(new URL(url).pathname);
  const packed = join(WORK_DIR, fileName);
  const unpacked = join(WORK_DIR, fileName.replace(/\.(bz2|gz|zst)$/i, ""));
  try {
    const bytes = await downloadTo(url, packed);
    log(`baixou ${fileName} (${(bytes / 1024 / 1024).toFixed(0)} MB)`);
    const demo = await unpackDemo(packed, unpacked);
    const record = extractMatch(demo, { fileName: basename(demo), uploadedBy: "valve" });
    const result = await sendRecord(record, await fingerprintOfFile(demo));
    const archived = await archiveDemo(demo);
    log(`acervo: ${basename(demo)} ${archived === "existing" ? "ja existe" : "enviada"}`);
    state.done[shareCode] = { matchId: result, at: new Date().toISOString() };
    log(`${result}: ${record.map} ${record.score.A}-${record.score.B}`);
  } finally {
    await rm(packed, { force: true });
    await rm(unpacked, { force: true });
  }
}

async function sweep(config: AgentConfig, state: AgentState, limit: number): Promise<number> {
  state.pending ??= {};

  for (const player of config.players) {
    const cursor = state.cursors[player.steamId] ?? player.shareCode;
    let codes: string[];
    try {
      codes = await collectShareCodes(
        config.steamApiKey,
        player.steamId,
        player.authCode,
        cursor,
        MAX_CHAIN,
      );
    } catch (error) {
      if (error instanceof SteamChainError) {
        log(`${player.nick}: ${error.message}`);
        continue;
      }
      throw error;
    }
    if (codes.length === 0) continue;
    log(`${player.nick}: ${codes.length} sharecode(s) novo(s) na cadeia`);
    for (const shareCode of codes) {
      if (!state.done[shareCode] && !state.gone[shareCode]) state.pending[shareCode] = player.nick;
    }
    state.cursors[player.steamId] = codes[codes.length - 1];
  }
  await saveState(state);

  const queue = Object.entries(state.pending);
  if (queue.length === 0) return 0;

  const session = new MatchmakingSession();
  let processed = 0;
  try {
    log("conectando ao Game Coordinator...");
    await session.connect(config.bot);
    log("conectado");

    for (const [shareCode, nick] of queue) {
      if (processed >= limit) break;
      let url: string | null = null;
      try {
        url = await session.demoUrlFor(shareCode);
      } catch (error) {
        log(`${nick} ${shareCode}: ${error instanceof Error ? error.message : error}`);
        continue;
      }
      if (!url) {
        state.gone[shareCode] = new Date().toISOString();
        delete state.pending[shareCode];
        log(`${nick} ${shareCode}: sem link de demo (expirou ou o GC nao devolveu)`);
        await saveState(state);
        continue;
      }
      try {
        await ingest(shareCode, url, state);
        delete state.pending[shareCode];
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        log(`${nick} ${shareCode}: ${message}`);
      }
      await saveState(state);
      processed += 1;
      if (processed < limit) await pause(DOWNLOAD_MIN_MS, DOWNLOAD_MAX_MS);
    }
  } finally {
    session.disconnect();
  }
  return processed;
}

async function main() {
  const args = process.argv.slice(2);
  const once = args.includes("--once");
  const flag = (name: string) => {
    const found = args.find((arg) => arg.startsWith(`${name}=`));
    return found ? found.slice(name.length + 1) : null;
  };
  const limit = Number(flag("--limit") ?? Number.MAX_SAFE_INTEGER);

  requireEnv("CS2STATS_URL");
  await mkdir(WORK_DIR, { recursive: true });
  const config = loadConfig();
  const state = await loadState();
  log(
    `${config.players.length} jogador(es) · ${Object.keys(state.done).length} partida(s) ja processada(s)`,
  );

  for (;;) {
    try {
      const processed = await sweep(config, state, limit);
      await saveState(state);
      log(`varredura terminou, ${processed} processada(s)`);
    } catch (error) {
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
