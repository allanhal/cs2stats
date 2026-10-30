import { open } from "node:fs/promises";
import { basename } from "node:path";

interface ArchiveFile {
  name: string;
  size: number;
}

const archiveSite = () => (process.env.DEMO_ARCHIVE_URL ?? "https://public.allanpinheiro.com").replace(/\/$/, "");

async function archiveRequest(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${archiveSite()}${path}`, { ...init, signal: AbortSignal.timeout(300_000) });
}

export async function archivedDemos(): Promise<ArchiveFile[]> {
  const response = await archiveRequest("/api/files");
  if (!response.ok) throw new Error(`acervo respondeu ${response.status}`);
  const body = await response.json() as { files: ArchiveFile[] };
  if (!Array.isArray(body.files)) throw new Error("listagem do acervo invalida");
  return body.files;
}

export async function archiveDemo(filePath: string): Promise<"existing" | "uploaded"> {
  const file = await open(filePath, "r");
  let uploadPath: string | undefined;
  try {
    const { size } = await file.stat();
    const name = basename(filePath);
    if ((await archivedDemos()).some((entry) => entry.name === name && entry.size === size)) {
      return "existing";
    }
    const init = await archiveRequest("/api/uploads", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, size, type: "application/octet-stream" }),
    });
    if (init.status !== 201) throw new Error(`acervo recusou envio (${init.status})`);
    const upload = await init.json() as { id: string; chunkBytes: number };
    uploadPath = `/api/uploads/${encodeURIComponent(upload.id)}`;
    const chunkBytes = Math.min(8 * 1024 * 1024, upload.chunkBytes);
    if (!Number.isSafeInteger(chunkBytes) || chunkBytes <= 0) throw new Error("tamanho de bloco invalido");
    let offset = 0;
    let conflicts = 0;
    while (offset < size) {
      const buffer = Buffer.alloc(Math.min(chunkBytes, size - offset));
      const { bytesRead } = await file.read(buffer, 0, buffer.length, offset);
      if (bytesRead === 0) throw new Error("demo terminou antes do tamanho declarado");
      const response = await archiveRequest(`${uploadPath}?offset=${offset}`, {
        method: "PATCH",
        headers: { "content-type": "application/octet-stream" },
        body: buffer.subarray(0, bytesRead),
      });
      if (!response.ok && response.status !== 409) throw new Error(`acervo recusou bloco (${response.status})`);
      const { received } = await response.json() as { received: number };
      if (!Number.isSafeInteger(received) || received < 0 || received > size) throw new Error("offset do acervo invalido");
      if (response.status === 409) {
        if (++conflicts > 3) throw new Error("acervo nao conseguiu retomar envio");
      } else {
        if (received !== offset + bytesRead) throw new Error("acervo nao confirmou o bloco completo");
        conflicts = 0;
      }
      offset = received;
    }
    const complete = await archiveRequest(`${uploadPath}/complete`, { method: "POST" });
    if (!complete.ok) throw new Error(`acervo nao concluiu envio (${complete.status})`);
    const result = await complete.json() as { duplicate?: boolean };
    uploadPath = undefined;
    return result.duplicate ? "existing" : "uploaded";
  } finally {
    await file.close();
    if (uploadPath) await archiveRequest(uploadPath, { method: "DELETE" }).catch(() => undefined);
  }
}
