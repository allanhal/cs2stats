import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { del, list, put } from "@vercel/blob";
import { getPool, query } from "../lib/db";

const file = process.argv[2];
const name = basename(file);

const gone = await query<{ map: string }>(
  "delete from matches where file_name = $1 returning map",
  [name],
);
console.log("1. removido do banco:", gone[0]?.map ?? "(não estava lá)");

const bytes = await readFile(file);
console.log("2. enviando", (bytes.length / 1e6).toFixed(0), "MB para o bucket…");
const blob = await put(`incoming/${name}`, bytes, {
  access: "private",
  contentType: "application/octet-stream",
  addRandomSuffix: true,
  multipart: true,
});
console.log("   no bucket:", blob.pathname);

console.log("3. chamando /api/upload/ingest…");
const response = await fetch("http://localhost:3000/api/upload/ingest", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ pathname: blob.pathname, name, by: "teste-e2e" }),
});
console.log("   HTTP", response.status, await response.text());

const left = await list({ prefix: "incoming/" });
console.log("4. objetos restantes no bucket:", left.blobs.length,
  left.blobs.length ? "(deveria ser 0!)" : "— a demo foi descartada");
for (const leftover of left.blobs) await del(leftover.pathname);

const rows = await query<{ n: number }>("select count(*)::int as n from matches");
console.log("5. partidas no banco:", rows[0].n);
await getPool().end();
