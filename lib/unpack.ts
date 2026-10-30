import { createReadStream, createWriteStream } from "node:fs";
import { open } from "node:fs/promises";
import { pipeline } from "node:stream/promises";
import zlib from "node:zlib";
import bz2 from "unbzip2-stream";

const ZSTD = Buffer.from([0x28, 0xb5, 0x2f, 0xfd]);
const BZIP2 = Buffer.from("BZh");

export type Packing = "raw" | "zstd" | "bzip2";

export async function packingOf(file: string): Promise<Packing> {
  const handle = await open(file, "r");
  const head = Buffer.alloc(4);
  try {
    await handle.read(head, 0, 4, 0);
  } finally {
    await handle.close();
  }
  if (head.equals(ZSTD)) return "zstd";
  if (head.subarray(0, 3).equals(BZIP2)) return "bzip2";
  return "raw";
}

function decompressor(packing: Exclude<Packing, "raw">): NodeJS.ReadWriteStream {
  if (packing === "bzip2") return bz2();
  const create = (zlib as unknown as { createZstdDecompress?: () => NodeJS.ReadWriteStream })
    .createZstdDecompress;
  if (typeof create !== "function") {
    throw new Error("este Node nao descompacta .zst; atualize para a versao 22.15 ou mais nova");
  }
  return create();
}

export async function unpackDemo(source: string, target: string): Promise<string> {
  const packing = await packingOf(source);
  if (packing === "raw") return source;
  await pipeline(createReadStream(source), decompressor(packing), createWriteStream(target));
  return target;
}
