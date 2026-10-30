import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool, type PoolConfig } from "pg";
import { requireEnv } from "./env";

type TierKey = "neon" | "supabase" | "selfhost";

interface Tier {
  key: TierKey;
  variable: string;
  splitsCredentials: boolean;
}

const TIERS: Tier[] = [
  { key: "selfhost", variable: "SELFHOST_DATABASE_URL", splitsCredentials: false },
  { key: "supabase", variable: "SUPABASE_URL", splitsCredentials: true },
  { key: "neon", variable: "DATABASE_URL", splitsCredentials: false },
];

const FAILOVER_COOLDOWN_MS = 600_000;

const pools = new Map<TierKey, Pool>();
const skipUntil = new Map<TierKey, number>();

function decodeMaybe(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function parseConnectionString(raw: string): PoolConfig {
  const scheme = raw.indexOf("://");
  const at = raw.lastIndexOf("@");
  if (scheme < 0 || at < 0) return { connectionString: raw };

  const credentials = raw.slice(scheme + 3, at);
  const separator = credentials.indexOf(":");
  if (separator < 0) return { connectionString: raw };

  const rest = raw.slice(at + 1);
  const slash = rest.indexOf("/");
  const hostPort = slash < 0 ? rest : rest.slice(0, slash);
  const tail = slash < 0 ? "" : rest.slice(slash + 1);
  const [database = "postgres", search = ""] = tail.split("?");
  const lastColon = hostPort.lastIndexOf(":");
  const host = lastColon < 0 ? hostPort : hostPort.slice(0, lastColon);
  const port = lastColon < 0 ? 5432 : Number(hostPort.slice(lastColon + 1)) || 5432;
  const sslMode = new URLSearchParams(search).get("sslmode");

  return {
    user: decodeMaybe(credentials.slice(0, separator)),
    password: decodeMaybe(credentials.slice(separator + 1)),
    host,
    port,
    database,
    ssl: sslMode === "disable" ? false : { rejectUnauthorized: false },
  };
}

const number = (value: string | undefined, fallback: number) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

function build(config: PoolConfig): Pool {
  const created = new Pool({
    ...config,
    max: number(process.env.DATABASE_POOL_MAX, 10),
    idleTimeoutMillis: number(process.env.DATABASE_IDLE_TIMEOUT_MS, 30_000),
    connectionTimeoutMillis: number(process.env.DATABASE_CONNECT_TIMEOUT_MS, 8_000),
  });
  created.on("error", () => {});
  return created;
}

function configuredTiers(): Tier[] {
  return TIERS.filter((tier) => Boolean(process.env[tier.variable]));
}

function poolFor(tier: Tier): Pool {
  const existing = pools.get(tier.key);
  if (existing) return existing;

  const raw = requireEnv(tier.variable);
  const created = build(tier.splitsCredentials ? parseConnectionString(raw) : { connectionString: raw });
  pools.set(tier.key, created);
  return created;
}

function discard(tier: Tier): void {
  const dead = pools.get(tier.key);
  pools.delete(tier.key);
  void dead?.end().catch(() => {});
}

function paused(tier: Tier): boolean {
  return Date.now() < (skipUntil.get(tier.key) ?? 0);
}

function pause(tier: Tier, error: unknown): void {
  skipUntil.set(tier.key, Date.now() + FAILOVER_COOLDOWN_MS);
  discard(tier);
  console.error(
    `[db] ${tier.key} (${tier.variable}) indisponível, pausado por ${FAILOVER_COOLDOWN_MS}ms:`,
    (error as Error).message,
  );
}

function tierOrder(): Tier[] {
  const all = configuredTiers();
  if (all.length === 0) {
    throw new Error(
      "nenhum banco configurado: defina DATABASE_URL, SUPABASE_URL ou SELFHOST_DATABASE_URL",
    );
  }

  const ready = all.filter((tier) => !paused(tier));
  return ready.length > 0 ? [...ready, ...all.filter(paused)] : all;
}

const FAILOVER_ERRORS = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "57P01",
  "57P03",
  "53000",
  "53200",
  "53300",
  "08006",
  "08003",
  "08001",
  "08004",
  "XX000",
]);

function isFailoverError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  if (code && FAILOVER_ERRORS.has(code)) return true;
  const message = (error as { message?: string }).message ?? "";
  return /connection terminated|connection closed|socket hang up|timeout expired|pool after calling end|client has encountered a connection error|exceeded the quota/i.test(
    message,
  );
}

async function runOn<T extends Record<string, unknown>>(
  tier: Tier,
  sql: string,
  values: unknown[],
): Promise<T[]> {
  try {
    const result = await poolFor(tier).query(sql, values);
    return result.rows as T[];
  } catch (error) {
    if (!isFailoverError(error)) throw error;

    discard(tier);
    const result = await poolFor(tier).query(sql, values);
    return result.rows as T[];
  }
}

async function runOnFirstAvailable<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[],
): Promise<T[]> {
  let lastError: unknown;

  for (const tier of tierOrder()) {
    try {
      return await runOn<T>(tier, sql, values);
    } catch (error) {
      if (!isFailoverError(error)) throw error;
      pause(tier, error);
      lastError = error;
    }
  }

  throw lastError;
}

export function getPool(): Pool {
  return poolFor(tierOrder()[0]);
}

export function hasMirror(): boolean {
  return Boolean(process.env.SUPABASE_URL);
}

export function getMirrorPool(): Pool {
  const tier = TIERS.find((candidate) => candidate.key === "supabase");
  if (!tier) throw new Error("não há tier supabase configurado");
  return poolFor(tier);
}

export function poolOf(key: TierKey): Pool | null {
  const tier = TIERS.find((candidate) => candidate.key === key);
  if (!tier || !process.env[tier.variable]) return null;
  return poolFor(tier);
}

export function tierKeys(): TierKey[] {
  return configuredTiers().map((tier) => tier.key);
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return runOnFirstAvailable<T>(sql, values);
}

export async function readQuery<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  return runOnFirstAvailable<T>(sql, values);
}

export async function writeQuery<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  let accepted: T[] | null = null;
  let lastError: unknown;
  const missed: string[] = [];

  for (const tier of tierOrder()) {
    try {
      const rows = await runOn<T>(tier, sql, values);
      if (accepted === null) accepted = rows;
    } catch (error) {
      if (accepted === null && !isFailoverError(error)) throw error;

      if (isFailoverError(error)) pause(tier, error);
      else
        console.error(
          `[db] ${tier.key} recusou uma escrita que outro banco aceitou:`,
          (error as Error).message,
        );

      missed.push(tier.key);
      lastError = error;
    }
  }

  if (accepted === null) throw lastError;

  if (missed.length > 0) {
    console.error(
      `[db] escrita não chegou em ${missed.join(", ")}; rode \`pnpm mirror\` para reconciliar`,
    );
  }

  return accepted;
}

export async function migrate(): Promise<void> {
  const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");

  const tiers = configuredTiers();
  const failures: unknown[] = [];

  for (const tier of tiers) {
    try {
      await poolFor(tier).query(schema);
      console.log(`[db] esquema aplicado em ${tier.key}`);
    } catch (error) {
      console.error(`[db] esquema falhou em ${tier.key}:`, (error as Error).message);
      failures.push(error);
    }
  }

  if (failures.length === tiers.length) throw failures[0];
}
