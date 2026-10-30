import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveDemo } from "../lib/demo-archive";

const directory = await mkdtemp(join(tmpdir(), "demo-archive-test-"));
const path = join(directory, "match.dem");
const bytes = Buffer.from("demo archive payload");
await writeFile(path, bytes);
let exists = false;
let fail = false;
let conflict = true;
let received = Buffer.alloc(0);
let inits = 0;
let aborted = 0;
let completed = 0;
const server = createServer(async (request, response) => {
  response.setHeader("content-type", "application/json");
  const url = new URL(request.url!, "http://localhost");
  if (request.method === "GET") {
    response.end(JSON.stringify({ files: exists ? [{ name: "match.dem", size: bytes.length }] : [] }));
  } else if (request.method === "DELETE") {
    aborted++;
    response.end("{}");
  } else if (request.method === "PATCH") {
    const chunks: Buffer[] = [];
    for await (const chunk of request) chunks.push(chunk);
    if (fail) {
      response.writeHead(503).end("{}");
    } else if (conflict) {
      conflict = false;
      response.writeHead(409).end(JSON.stringify({ received: received.length }));
    } else {
      assert.equal(Number(url.searchParams.get("offset")), received.length);
      received = Buffer.concat([received, ...chunks]);
      response.end(JSON.stringify({ received: received.length }));
    }
  } else if (url.pathname.endsWith("/complete")) {
    completed++;
    response.end("{}");
  } else {
    inits++;
    response.writeHead(201).end(JSON.stringify({ id: "test", chunkBytes: 5 }));
  }
});
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const address = server.address();
assert(address && typeof address !== "string");
process.env.DEMO_ARCHIVE_URL = `http://127.0.0.1:${address.port}`;
try {
  assert.equal(await archiveDemo(path), "uploaded");
  assert.deepEqual(received, bytes);
  assert.equal(completed, 1);
  exists = true;
  assert.equal(await archiveDemo(path), "existing");
  assert.equal(inits, 1);
  exists = false;
  fail = true;
  await assert.rejects(archiveDemo(path), /503/);
  assert.equal(aborted, 1);
  assert.equal(completed, 1);
  console.log("archive: chunked upload, offset recovery, duplicate skip and failed upload cleanup passed");
} finally {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await rm(directory, { recursive: true });
}
