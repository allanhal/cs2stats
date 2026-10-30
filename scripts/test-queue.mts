import assert from "node:assert/strict";
import { createUploadQueue, UploadFailure, type QueueItem, type Sender } from "../lib/upload-queue";

const demo = (name: string, size = 1000) => new File([new Uint8Array(size)], name);
const wait = (ms = 0) => new Promise((r) => setTimeout(r, ms));
let id = 0;
const newId = () => `id-${++id}`;

function harness(send: Sender) {
  let latest: QueueItem[] = [];
  const peaks: number[] = [];
  const queue = createUploadQueue({
    send,
    newId,
    onChange: (items) => {
      latest = items;
      peaks.push(items.filter((i) => i.status === "uploading" || i.status === "parsing").length);
    },
  });
  return { queue, items: () => latest, maxInFlight: () => Math.max(0, ...peaks) };
}

{
  const order: string[] = [];
  const h = harness(async (file, hooks) => {
    order.push(file.name);
    hooks.onProgress(0.5);
    await wait(5);
    hooks.onParsing();
    await wait(5);
    return { matchId: `m-${file.name}`, map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("c.dem"), demo("a.dem"), demo("b.dem")]);
  await wait(120);
  assert.deepEqual(order, ["a.dem", "b.dem", "c.dem"], "ordem alfabética (= cronológica)");
  assert.equal(h.maxInFlight(), 1, "só um upload em voo por vez");
  assert.equal(h.items().filter((i) => i.status === "done").length, 3);
  console.log("ok  1. sequencial, um por vez, ordenado");
}

{
  const h = harness(async (file) => {
    if (file.name === "ruim.dem") throw new Error("demo corrompida");
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("a.dem"), demo("ruim.dem"), demo("z.dem")]);
  await wait(80);
  const items = h.items();
  assert.equal(items.find((i) => i.name === "ruim.dem")?.status, "error");
  assert.equal(items.find((i) => i.name === "ruim.dem")?.message, "demo corrompida");
  assert.equal(items.filter((i) => i.status === "done").length, 2, "os outros dois seguiram");
  console.log("ok  2. erro não interrompe a fila");
}

{
  const seen: string[] = [];
  const h = harness(async (file) => {
    seen.push(file.name);
    await wait(15);
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("1.dem")]);
  await wait(5);
  h.queue.add([demo("2.dem")]);
  await wait(10);
  h.queue.add([demo("3.dem")]);
  await wait(120);
  assert.deepEqual(seen, ["1.dem", "2.dem", "3.dem"], "sem upload paralelo nem item esquecido");
  assert.equal(h.maxInFlight(), 1);
  assert.equal(h.items().filter((i) => i.status === "done").length, 3);
  console.log("ok  3. adicionar durante o processamento");
}

{
  const h = harness(async () => {
    throw new UploadFailure("Essa partida já foi enviada", { matchId: "abc", duplicate: true });
  });
  h.queue.add([demo("dup.dem")]);
  await wait(40);
  const item = h.items()[0];
  assert.equal(item.status, "error");
  assert.equal(item.duplicate, true);
  assert.equal(item.result?.matchId, "abc");
  console.log("ok  4. duplicata aponta para a partida existente");
}

{
  let sent = 0;
  const h = harness(async () => {
    sent++;
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("ok.dem"), new File([], "foto.png"), new File([], "notas.txt")]);
  await wait(40);
  assert.equal(sent, 1, "só o .dem foi enviado");
  const rejected = h.items().find((i) => i.message === "Só arquivos .dem, .dem.zst ou .dem.bz2 são aceitos");
  assert.equal(rejected?.name, "2 arquivos ignorados");
  console.log("ok  5. recusa o que não é .dem");
}

{
  const h = harness(async (file) => {
    if (file.name === "b-lento.dem") await wait(80);
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("b-lento.dem"), demo("a-rapido.dem")]);
  await wait(30);
  h.queue.clearFinished();
  const names = h.queue.items().map((i) => i.name);
  assert.deepEqual(names, ["b-lento.dem"], "o concluído saiu, o em andamento ficou");
  await wait(120);
  console.log("ok  6. limpar a lista preserva o que está rodando");
}

{
  const seen: number[] = [];
  const h = harness(async (_file, hooks) => {
    hooks.onProgress(-1);
    hooks.onProgress(0.42);
    hooks.onProgress(5);
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("p.dem")]);
  await wait(40);
  for (const item of h.items()) seen.push(item.progress);
  assert.ok(seen.every((p) => p >= 0 && p <= 1), `progresso fora de 0..1: ${seen}`);
  console.log("ok  7. progresso sempre entre 0 e 1");
}

{
  const got: string[] = [];
  const h = harness(async (_file, _hooks, by) => {
    got.push(by);
    await wait(10);
    return { matchId: "m", map: "de_x", rounds: 24, players: 10 };
  });
  h.queue.add([demo("a.dem")], "allan");
  h.queue.add([demo("b.dem")], "mendz");
  await wait(80);
  assert.deepEqual(got, ["allan", "mendz"], "cada item carrega o nick do seu envio");
  console.log("ok  8. nick capturado por lote");
}

console.log("\n8/8 passaram");
