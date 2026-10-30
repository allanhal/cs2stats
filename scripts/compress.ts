import zlib from "node:zlib";
import { getPool, migrate } from "../lib/db";
import type { MatchRecord, PlayerMatchStats } from "../lib/types";

const pack = (value: unknown): Buffer => zlib.gzipSync(Buffer.from(JSON.stringify(value), "utf8"));

async function main() {
  await migrate();

  const client = await getPool().connect();
  try {
    await client.query("begin");

    const typed = await client.query<{ data_type: string }>(
      "select data_type from information_schema.columns where table_name = 'matches' and column_name = 'record'",
    );
    if (typed.rows[0]?.data_type === "bytea") {
      await client.query("commit");
      console.log("nada a fazer: record já está comprimido");
      return;
    }

    await client.query("alter table matches add column if not exists record_gz bytea");

    const { rows } = await client.query<{ id: string; record: MatchRecord }>(
      "select id, record from matches",
    );

    let cells = 0;
    for (const row of rows) {
      const heatmaps: [string, Record<string, number>][] = [];
      const players = row.record.players.map((player) => {
        const { heatmap, ...rest } = player;
        if (heatmap && Object.keys(heatmap).length > 0) heatmaps.push([player.steamId, heatmap]);
        return rest as PlayerMatchStats;
      });

      await client.query("update matches set record_gz = $2 where id = $1", [
        row.id,
        pack({ ...row.record, players }),
      ]);
      await client.query("delete from match_heatmaps where match_id = $1", [row.id]);
      for (const [steamId, heatmap] of heatmaps) {
        await client.query(
          "insert into match_heatmaps (match_id, steam_id, heatmap) values ($1, $2, $3)",
          [row.id, steamId, pack(heatmap)],
        );
        cells += Object.keys(heatmap).length;
      }
    }

    await client.query("alter table matches drop column record");
    await client.query("alter table matches rename column record_gz to record");
    await client.query("alter table matches alter column record set not null");
    await client.query("update app_config set revision = revision + 1 where id = 1");
    await client.query("commit");

    console.log(`${rows.length} partidas comprimidas · ${cells} células de mapa de calor`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }

  const size = await getPool().query<{ matches: string; heatmaps: string }>(
    `select pg_size_pretty(pg_total_relation_size('matches')) as matches,
            pg_size_pretty(pg_total_relation_size('match_heatmaps')) as heatmaps`,
  );
  console.log("tamanho:", size.rows[0]);
  await getPool().end();
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
