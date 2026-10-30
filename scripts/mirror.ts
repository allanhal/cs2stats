import { readFile } from "node:fs/promises";
import path from "node:path";
import type { Pool } from "pg";
import { poolOf, tierKeys } from "../lib/db";

interface TableSync {
  name: string;
  key: string[];
  columns: string[];
  binary?: string[];
}

const TABLES: TableSync[] = [
  {
    name: "app_config",
    key: ["id"],
    columns: [
      "id",
      "team_name",
      "tracked_steam_ids",
      "hidden_steam_ids",
      "aliases",
      "display_names",
      "revision",
    ],
  },
  {
    name: "matches",
    key: ["id"],
    columns: [
      "id",
      "version",
      "played_at",
      "uploaded_at",
      "uploaded_by",
      "file_name",
      "file_size_bytes",
      "map",
      "total_rounds",
      "fingerprint",
      "record",
      "file_hash",
    ],
    binary: ["record"],
  },
  {
    name: "match_heatmaps",
    key: ["match_id", "steam_id"],
    columns: ["match_id", "steam_id", "heatmap"],
    binary: ["heatmap"],
  },
  {
    name: "steam_profiles",
    key: ["steam_id"],
    columns: ["steam_id", "persona", "avatar", "fetched_at"],
  },
  {
    name: "steam_users",
    key: ["steam_id"],
    columns: ["steam_id", "persona", "avatar", "created_at", "last_seen_at"],
  },
  {
    name: "share_codes",
    key: ["code"],
    columns: ["code", "added_by", "added_at", "status", "match_id"],
  },
];

const BATCH = 50;
const SEPARATOR = "\u0000";

function selectList(table: TableSync): string {
  return table.columns
    .map((column) =>
      table.binary?.includes(column) ? `encode(${column}, 'base64') as ${column}` : column,
    )
    .join(", ");
}

function keyOf(table: TableSync, row: Record<string, unknown>): string {
  return table.key.map((column) => String(row[column])).join(SEPARATOR);
}

async function syncTable(
  table: TableSync,
  source: Pool,
  target: Pool,
  prune: boolean,
): Promise<void> {
  const { rows } = await source.query(`select ${selectList(table)} from ${table.name}`);

  for (let i = 0; i < rows.length; i += BATCH) {
    const slice = rows.slice(i, i + BATCH);
    const values: unknown[] = [];
    const tuples = slice.map((row) => {
      const placeholders = table.columns.map((column) => {
        const raw = row[column];
        values.push(
          table.binary?.includes(column) && typeof raw === "string"
            ? Buffer.from(raw, "base64")
            : raw,
        );
        return `$${values.length}`;
      });
      return `(${placeholders.join(", ")})`;
    });

    const updates = table.columns
      .filter((column) => !table.key.includes(column))
      .map((column) => `${column} = excluded.${column}`)
      .join(", ");

    await target.query(
      `insert into ${table.name} (${table.columns.join(", ")})
       values ${tuples.join(", ")}
       on conflict (${table.key.join(", ")}) do update set ${updates}`,
      values,
    );
  }

  let removed = 0;

  if (prune) {
    const live = new Set(rows.map((row) => keyOf(table, row)));
    const existing = await target.query(`select ${table.key.join(", ")} from ${table.name}`);
    const extra = existing.rows.filter((row) => !live.has(keyOf(table, row)));

    for (const row of extra) {
      const where = table.key.map((column, i) => `${column} = $${i + 1}`).join(" and ");
      await target.query(
        `delete from ${table.name} where ${where}`,
        table.key.map((column) => row[column]),
      );
    }

    removed = extra.length;
  }

  const suffix = removed > 0 ? `, ${removed} apagada(s)` : "";
  console.log(`  ${table.name}: ${rows.length} copiada(s)${suffix}`);
}

async function countMatches(pool: Pool): Promise<number> {
  try {
    const { rows } = await pool.query("select count(*)::int as n from matches");
    return (rows[0] as { n: number }).n;
  } catch {
    return 0;
  }
}

async function main() {
  const prune = process.argv.includes("--prune");
  const requested = process.argv.find((arg) => arg.startsWith("--from="))?.slice("--from=".length);

  const reachable: { name: string; pool: Pool; matches: number }[] = [];

  for (const key of tierKeys()) {
    const pool = poolOf(key);
    if (!pool) continue;

    try {
      await pool.query("select 1");
      reachable.push({ name: key, pool, matches: await countMatches(pool) });
    } catch (error) {
      console.log(`${key}: fora do ar, fica de fora (${(error as Error).message})`);
    }
  }

  if (reachable.length < 2) {
    throw new Error("preciso de pelo menos dois bancos no ar para reconciliar");
  }

  const source = requested
    ? reachable.find((tier) => tier.name === requested)
    : [...reachable].sort((a, b) => b.matches - a.matches)[0];

  if (!source) {
    throw new Error(`o banco ${requested} não está no ar`);
  }

  const schema = await readFile(path.join(process.cwd(), "db", "schema.sql"), "utf8");

  console.log(
    `fonte: ${source.name}, ${source.matches} partidas${prune ? " (--prune: apaga o que não existe na fonte)" : " (sem apagar nada)"}`,
  );

  for (const target of reachable.filter((tier) => tier.name !== source.name)) {
    console.log(`-> ${target.name}, ${target.matches} partidas`);
    await target.pool.query(schema);

    for (const table of TABLES) {
      await syncTable(table, source.pool, target.pool, prune);
    }
  }

  console.log("bancos reconciliados");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
