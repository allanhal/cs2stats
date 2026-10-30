import { del, get } from "@vercel/blob";

export const MAX_DEMO_BYTES = 800 * 1024 * 1024;
export const DEMO_PREFIX = "incoming/";

export function isDemoName(fileName: string): boolean {
  return /\.dem(\.zst|\.bz2)?$/i.test(fileName);
}

export async function readDemo(pathname: string) {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) {
    throw new Error("A demo enviada não foi encontrada no bucket");
  }
  return result;
}

export async function discardDemo(pathname: string): Promise<void> {
  await del(pathname);
}
