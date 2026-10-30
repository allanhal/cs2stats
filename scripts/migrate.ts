import { getPool, migrate } from "../lib/db";

async function main() {
  await migrate();
  const { rows } = await getPool().query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  );
  console.log("Tabelas:", rows.map((r) => r.table_name).join(", "));
  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
