import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const root = path.resolve(import.meta.dirname, "..");
const repo = "LaihoE/demoparser";
const TRIPLES = ["darwin-arm64", "darwin-x64", "win32-x64-msvc", "win32-arm64-msvc"];

interface Pins {
  version: string;
  patch: string;
  build: string;
}

function pick(text: string, pattern: RegExp, label: string): string {
  const found = text.match(pattern);
  if (!found) throw new Error(`não achei ${label}`);
  return found[1];
}

async function shellPins(): Promise<Pins> {
  const text = await readFile(path.join(root, "public/cs2stats.sh"), "utf8");
  return {
    version: pick(text, /^PARSER_VERSION="([^"]+)"/m, "PARSER_VERSION em cs2stats.sh"),
    patch: pick(text, /^PARSER_PATCH="([^"]+)"/m, "PARSER_PATCH em cs2stats.sh"),
    build: pick(text, /^PARSER_BUILD="([^"]+)"/m, "PARSER_BUILD em cs2stats.sh"),
  };
}

async function powershellPins(): Promise<Pins> {
  const text = await readFile(path.join(root, "public/cs2stats.ps1"), "utf8");
  return {
    version: pick(text, /^\$ParserVersion = "([^"]+)"/m, "$ParserVersion em cs2stats.ps1"),
    patch: pick(text, /^\$ParserPatch = "([^"]+)"/m, "$ParserPatch em cs2stats.ps1"),
    build: pick(text, /^\$ParserBuild = "([^"]+)"/m, "$ParserBuild em cs2stats.ps1"),
  };
}

function bySemver(a: string, b: string): number {
  const parts = (value: string) => value.split(/[.-]/).map((piece) => Number(piece) || 0);
  const [x, y] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) {
    if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
  }
  return 0;
}

async function latestPublished(name: string): Promise<string> {
  const response = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`);
  if (!response.ok) return "";
  const body = (await response.json()) as {
    versions?: Record<string, { dist?: { tarball?: string } }>;
  };
  const versions = Object.keys(body.versions ?? {}).sort(bySemver).reverse();
  for (const version of versions.slice(0, 4)) {
    const tarball = body.versions?.[version]?.dist?.tarball;
    if (!tarball) continue;
    const head = await fetch(tarball, { method: "HEAD" });
    if (head.ok) return version === versions[0] ? version : `${version} (${versions[0]} sem tarball)`;
  }
  return versions[0] ? `${versions[0]} sem tarball` : "";
}

async function upstreamCommits(build: string) {
  const response = await fetch(`https://api.github.com/repos/${repo}/compare/${build}...main`);
  if (!response.ok) throw new Error(`github respondeu ${response.status}`);
  const body = (await response.json()) as {
    commits?: { sha: string; commit: { message: string } }[];
    files?: { filename: string }[];
  };
  const commits = body.commits ?? [];
  const files = (body.files ?? []).map((file) => file.filename);
  const touchesParser = files.some(
    (file) => file.startsWith("src/parser/") || file.startsWith("src/node/"),
  );
  return { commits, touchesParser };
}

async function digest(file: string): Promise<string> {
  return createHash("sha256").update(await readFile(file)).digest("hex").slice(0, 12);
}

async function newestDemo(): Promise<string> {
  const given = process.argv[2] ?? process.env.PARSER_DEMO;
  if (given) return given;
  const folder = path.join(process.env.HOME ?? "", "Downloads");
  let newest = "";
  let when = 0;
  for (const name of await readdir(folder)) {
    if (!name.endsWith(".dem")) continue;
    const file = path.join(folder, name);
    const info = await stat(file);
    if (info.mtimeMs > when) {
      when = info.mtimeMs;
      newest = file;
    }
  }
  return newest;
}

async function main() {
  const shell = await shellPins();
  const powershell = await powershellPins();
  let pending = false;

  console.log(`fixado: parser ${shell.version}, build ${shell.build}, CS2 ${shell.patch}`);

  for (const field of ["version", "patch", "build"] as const) {
    if (shell[field] !== powershell[field]) {
      console.log(`os dois instaladores discordam em ${field}: ${shell[field]} x ${powershell[field]}`);
      pending = true;
    }
  }

  const served = path.join(root, "public/parser");
  const local = path.join(root, "node_modules/@laihoe/demoparser2");
  const triple = process.platform === "darwin" ? (process.arch === "arm64" ? "darwin-arm64" : "darwin-x64") : "";
  for (const name of TRIPLES) {
    console.log(`  ${name}: ${await digest(path.join(served, `demoparser2.${name}.node`))}`);
  }
  if (triple) {
    const mine = await digest(path.join(served, `demoparser2.${triple}.node`));
    const here = await digest(path.join(local, `demoparser2.${triple}.node`)).catch(() => "");
    if (mine !== here) {
      console.log(`o binário do node_modules (${here || "ausente"}) não é o que o site serve (${mine})`);
      pending = true;
    }
  }

  const upstream = await upstreamCommits(shell.build);
  if (upstream.commits.length === 0) {
    console.log("upstream: nada novo desde o build fixado");
  } else {
    console.log(
      `upstream: ${upstream.commits.length} commit(s) novo(s)${upstream.touchesParser ? ", mexendo no parser" : ", nada no parser"}`,
    );
    for (const commit of upstream.commits) {
      console.log(`  ${commit.sha.slice(0, 7)} ${commit.commit.message.split("\n")[0]}`);
    }
    if (upstream.touchesParser) pending = true;
  }

  const main = await latestPublished("@laihoe/demoparser2");
  console.log(`npm: pacote principal em ${main || "?"}`);
  for (const name of TRIPLES) {
    console.log(`  @laihoe/demoparser2-${name}: ${(await latestPublished(`@laihoe/demoparser2-${name}`)) || "?"}`);
  }

  const demo = await newestDemo();
  if (!demo) {
    console.log("sem demo para testar; passe o caminho como argumento");
    pending = true;
  } else {
    try {
      const parsed = await run(path.join(root, "node_modules/.bin/tsx"), [
        path.join(root, "scripts/test-extract.ts"),
        demo,
      ], { cwd: root, maxBuffer: 64 * 1024 * 1024 });
      const rounds = parsed.stdout.match(/\| (\d+) rounds \|/)?.[1] ?? "?";
      console.log(`demo ${path.basename(demo)}: leu, ${rounds} rounds`);
    } catch (error) {
      console.log(`demo ${path.basename(demo)}: falhou — ${(error as Error).message.split("\n")[0]}`);
      pending = true;
    }
  }

  console.log(pending ? "tem coisa pendente" : "tudo em dia");
  process.exitCode = pending ? 1 : 0;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
