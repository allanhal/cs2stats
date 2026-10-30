import { query } from "@/lib/db";

const LEASE_SECONDS = 360;

export async function acquireIngestLock(): Promise<string | null> {
  const token = crypto.randomUUID();
  const rows = await query<{ token: string }>(
    `insert into ingest_lock (id, token, locked_until)
     values (1, $1, now() + ($2 || ' seconds')::interval)
     on conflict (id) do update
       set token = excluded.token, locked_until = excluded.locked_until
       where ingest_lock.locked_until < now()
     returning token`,
    [token, String(LEASE_SECONDS)],
  );
  return rows.length > 0 ? token : null;
}

export async function releaseIngestLock(token: string): Promise<void> {
  await query(
    "update ingest_lock set locked_until = now() - interval '1 second' where token = $1",
    [token],
  );
}
