export const HASH_CHUNK = 4 * 1024 * 1024;

type Reader = (start: number, end: number) => Promise<Uint8Array>;

export async function demoFingerprint(size: number, read: Reader): Promise<string> {
  const head = await read(0, Math.min(HASH_CHUNK, size));
  const tail = await read(Math.max(size - HASH_CHUNK, 0), size);

  const label = new TextEncoder().encode(`${size}:`);
  const buffer = new Uint8Array(label.length + head.length + tail.length);
  buffer.set(label, 0);
  buffer.set(head, label.length);
  buffer.set(tail, label.length + head.length);

  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function fingerprintFile(file: File): Promise<string> {
  return demoFingerprint(file.size, async (start, end) =>
    new Uint8Array(await file.slice(start, end).arrayBuffer()),
  );
}
