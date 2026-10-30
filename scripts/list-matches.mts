import { getPool, query } from "../lib/db";
const rows = await query<{ map: string; file_name: string; uploaded_by: string; uploaded_at: string; played_at: string; total_rounds: number }>(
  "select map, file_name, uploaded_by, uploaded_at, played_at, total_rounds from matches order by uploaded_at",
);
for (const r of rows) {
  console.log(
    `${r.map.padEnd(12)} ${String(r.total_rounds).padStart(2)}r  por: ${String(r.uploaded_by).padEnd(12)} enviado: ${new Date(r.uploaded_at).toISOString().slice(0,16)}  arquivo: ${r.file_name.slice(0,60)}`,
  );
}
await getPool().end();
