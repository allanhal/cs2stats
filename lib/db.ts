import { readFile } from "node:fs/promises";
import path from "node:path";
import { Pool } from "pg";

let pool: Pool | null = null;

export function getPool(): Pool {
  if (pool) return pool;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL não está definida. Rode `neon deploy` para provisionar o banco e gerar o .env.local.",
    );
  }

  const number = (value: string | undefined, fallback: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  pool = new Pool({
    connectionString,
    max: number(process.env.DATABASE_POOL_MAX, 10),
    idleTimeoutMillis: number(process.env.DATABASE_IDLE_TIMEOUT_MS, 30_000),
  });

  if (process.env.VERCEL) {
    void import("@vercel/functions")
      .then(({ attachDatabasePool }) => attachDatabasePool(pool!))
      .catch(() => {
      });
  }

  return pool;
}

const CONNECTION_ERRORS = new Set([
  "ECONNRESET",
  "EPIPE",
  "ETIMEDOUT",
  "ENOTFOUND",
  "ECONNREFUSED",
  "57P01",
  "57P03",
  "08006",
  "08003",
]);

function isConnectionError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const code = (error as { code?: string }).code;
  if (code && CONNECTION_ERRORS.has(code)) return true;
  const message = (error as { message?: string }).message ?? "";
  return /connection terminated|connection closed|socket hang up/i.test(message);
}

export async function query<T extends Record<string, unknown>>(
  sql: string,
  values: unknown[] = [],
): Promise<T[]> {
  try {
    const result = await getPool().query(sql, values);
    return result.rows as T[];
  } catch (error) {
    if (!isConnectionError(error)) throw error;

    const dead = pool;
    pool = null;
    void dead?.end().catch(() => {});

    const result = await getPool().query(sql, values);
    return result.rows as T[];
  }
}

export async function migrate(): Promise<void> {
  const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");
  await getPool().query(schema);
}
