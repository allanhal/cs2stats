#!/usr/bin/env bash
set -euo pipefail

SITE="https://cs2.allanpinheiro.com"
FALLBACK_SITE="https://cs2-backup.allanpinheiro.com"
SITE_PINNED=false
ARCHIVE="https://public.allanpinheiro.com"
ARCHIVE_ENABLED=true
ARCHIVE_CHUNK=$((8 * 1024 * 1024))
NICK="${USER:-anonimo}"
WHAT_IF=false
NODE_VERSION="v24.22.2"
NODE_MINIMUM=22
PARSER_VERSION="0.42.0"
PARSER_PATCH="14197"
HASH_CHUNK=$((4 * 1024 * 1024))
PATHS=()

usage() {
  printf '%s\n' "uso: cs2stats.sh [--path pasta] [--nick nome] [--site url] [--archive url] [--no-archive] [--what-if]"
}

while (($#)); do
  case "$1" in
    --path)
      (($# >= 2)) || { usage; exit 1; }
      PATHS+=("$2")
      shift 2
      ;;
    --nick)
      (($# >= 2)) || { usage; exit 1; }
      NICK="$2"
      shift 2
      ;;
    --site)
      (($# >= 2)) || { usage; exit 1; }
      SITE="${2%/}"
      SITE_PINNED=true
      shift 2
      ;;
    --archive)
      (($# >= 2)) || { usage; exit 1; }
      ARCHIVE="${2%/}"
      shift 2
      ;;
    --no-archive)
      ARCHIVE_ENABLED=false
      shift
      ;;
    --what-if)
      WHAT_IF=true
      shift
      ;;
    --help|-h)
      usage
      exit 0
      ;;
    *)
      printf '%s\n' "parâmetro desconhecido: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

BASE="${HOME}/Library/Application Support/cs2stats"
WORK_DIR="$BASE"
TEMP_DIR="$(mktemp -d "${TMPDIR:-/tmp}/cs2stats.XXXXXX")"
trap 'rm -rf "$TEMP_DIR"' EXIT

step() {
  printf '%s\n' "$1"
}

site_alive() {
  curl --fail --location --silent --show-error --head --max-time 90 "$1/robots.txt" >/dev/null 2>&1
}

resolve_site() {
  if [[ "$SITE_PINNED" == true ]]; then
    return
  fi
  if site_alive "$SITE"; then
    return
  fi
  if site_alive "$FALLBACK_SITE"; then
    step "Site principal fora do ar, usando $FALLBACK_SITE"
    SITE="$FALLBACK_SITE"
    return
  fi
  printf '%s\n' "Site fora do ar: $SITE" >&2
  exit 1
}

node_major() {
  local version
  version="$("$1" --version 2>/dev/null || true)"
  version="${version#v}"
  version="${version%%.*}"
  [[ "$version" =~ ^[0-9]+$ ]] || return 1
  printf '%s' "$version"
}

resolve_node() {
  local candidate major arch archive url node_dir
  if candidate="$(command -v node 2>/dev/null || true)"; then
    if [[ -n "$candidate" ]]; then
      major="$(node_major "$candidate" || true)"
      if [[ -n "$major" ]] && ((major >= NODE_MINIMUM)); then
        NODE="$candidate"
        return
      fi
    fi
  fi

  arch="$(uname -m)"
  case "$arch" in
    arm64|x86_64)
      ;;
    *)
      printf '%s\n' "não sei baixar o Node para a arquitetura $arch" >&2
      exit 1
      ;;
  esac

  node_dir="$WORK_DIR/node-${NODE_VERSION}-darwin-$arch"
  candidate="$node_dir/bin/node"
  if [[ ! -x "$candidate" ]]; then
    mkdir -p "$WORK_DIR"
    archive="$TEMP_DIR/node.tar.gz"
    url="https://nodejs.org/dist/$NODE_VERSION/node-${NODE_VERSION}-darwin-$arch.tar.gz"
    step "Baixando o Node $NODE_VERSION (só na primeira vez)..."
    curl --fail --location --silent --show-error "$url" -o "$archive"
    tar -xzf "$archive" -C "$WORK_DIR"
  fi

  [[ -x "$candidate" ]] || { printf '%s\n' "não consegui preparar o Node" >&2; exit 1; }
  NODE="$candidate"
}

run_npm() {
  local node_dir npm_cli
  node_dir="$(cd "$(dirname "$NODE")/.." && pwd)"
  npm_cli="$node_dir/lib/node_modules/npm/bin/npm-cli.js"
  if [[ -f "$npm_cli" ]]; then
    "$NODE" "$npm_cli" "$@"
    return
  fi
  command -v npm >/dev/null 2>&1 || { printf '%s\n' "não encontrei o npm junto do Node" >&2; exit 1; }
  npm "$@"
}

installed_parser_version() {
  local manifest="$WORK_DIR/node_modules/@laihoe/demoparser2/package.json"
  [[ -f "$manifest" ]] || return 0
  "$NODE" -e 'try { process.stdout.write(require(process.argv[1]).version || "") } catch {}' "$manifest"
}

initialize_parser() {
  local installed marker
  mkdir -p "$WORK_DIR"
  EXTRACTOR="$WORK_DIR/cs2stats-extract.mjs"
  step "Baixando o extrator..."
  curl --fail --location --silent --show-error "$SITE/cs2stats-extract.mjs" -o "$EXTRACTOR"

  marker="$WORK_DIR/node_modules/@laihoe/demoparser2/index.js"
  installed="$(installed_parser_version)"
  if [[ ! -f "$marker" || "$installed" != "$PARSER_VERSION" ]]; then
    if [[ -n "$installed" ]]; then
      step "Atualizando o parser $PARSER_VERSION..."
    else
      step "Instalando o parser $PARSER_VERSION..."
    fi
    (
      run_npm --prefix "$WORK_DIR" install --no-save --no-audit --no-fund --loglevel=error "@laihoe/demoparser2@$PARSER_VERSION"
    )
  fi
  [[ -f "$marker" ]] || { printf '%s\n' "não consegui instalar o parser" >&2; exit 1; }
  patch_parser
}

parser_triple() {
  case "$(uname -m)" in
    arm64) printf 'darwin-arm64' ;;
    *) printf 'darwin-x64' ;;
  esac
}

patch_parser() {
  local dir triple marker target
  dir="$WORK_DIR/node_modules/@laihoe/demoparser2"
  triple="$(parser_triple)"
  marker="$dir/cs2stats-patch.txt"
  target="$dir/demoparser2.$triple.node"
  if [[ -f "$target" && "$(cat "$marker" 2>/dev/null)" == "$PARSER_PATCH" ]]; then
    return 0
  fi
  step "Aplicando a correção do parser para o CS2 $PARSER_PATCH..."
  if curl --fail --location --silent --show-error --max-time 300 "$SITE/parser/demoparser2.$triple.node" -o "$target.novo"; then
    mv "$target.novo" "$target"
    printf '%s\n' "$PARSER_PATCH" > "$marker"
  else
    rm -f "$target.novo"
    step "  não consegui baixar a correção; sigo com o parser do npm"
  fi
}

add_path() {
  local candidate="$1" known
  [[ -d "$candidate" ]] || return 0
  for known in "${SEARCH_PATHS[@]-}"; do
    [[ "$known" == "$candidate" ]] && return 0
  done
  SEARCH_PATHS+=("$candidate")
}

steam_libraries() {
  local root vdf library
  for root in "$HOME/Library/Application Support/Steam" "$HOME/.steam/steam"; do
    [[ -d "$root" ]] || continue
    printf '%s\n' "$root"
    vdf="$root/steamapps/libraryfolders.vdf"
    [[ -f "$vdf" ]] || continue
    while IFS= read -r library; do
      [[ -n "$library" ]] && printf '%s\n' "${library//\\\\/\\}"
    done < <(sed -nE 's/^[[:space:]]*"path"[[:space:]]+"([^"]+)".*/\1/p' "$vdf")
  done
}

find_demos() {
  local directory demo known
  DEMOS=()
  for directory in "${SEARCH_PATHS[@]-}"; do
    while IFS= read -r -d '' demo; do
      for known in "${DEMOS[@]-}"; do
        [[ "$known" == "$demo" ]] && continue 2
      done
      DEMOS+=("$demo")
    done < <(find "$directory" -type f \( -iname '*.dem' -o -iname '*.dem.zst' -o -iname '*.dem.bz2' \) -print0 2>/dev/null)
  done
}

fingerprint() {
  local file="$1" size
  size="$(stat -f '%z' "$file")"
  {
    printf '%s:' "$size"
    head -c "$HASH_CHUNK" "$file"
    tail -c "$HASH_CHUNK" "$file"
  } | shasum -a 256 | awk '{print $1}'
}

json_field() {
  local field="$1" file="$2"
  "$NODE" -e 'const fs = require("fs"); try { const value = JSON.parse(fs.readFileSync(process.argv[2], "utf8"))[process.argv[1]]; process.stdout.write(value === undefined || value === null ? "" : String(value)) } catch {}' "$field" "$file"
}

post_json() {
  local url="$1" body="$2" response="$3"
  curl --silent --show-error --output "$response" --write-out '%{http_code}' --header 'content-type: application/json' --data-binary "@$body" "$url"
}

canonical_name() {
  "$NODE" -e 'process.stdout.write(process.argv[1].replace(/ \(\d+\)(\.dem(\.(zst|bz2))?)$/i, "$1"))' "$1"
}

archive_index() {
  [[ "$ARCHIVE_ENABLED" == true ]] || return 0
  ARCHIVE_INDEX="$TEMP_DIR/archive-index.txt"
  : > "$ARCHIVE_INDEX"
  local listing="$TEMP_DIR/archive-files.json"
  if ! curl --silent --show-error --max-time 60 --output "$listing" "$ARCHIVE/api/files"; then
    step "Não consegui falar com o acervo em $ARCHIVE; sigo sem guardar as demos."
    ARCHIVE_ENABLED=false
    return 0
  fi
  "$NODE" -e 'const fs = require("fs"); const canonical = (name) => name.replace(/ \(\d+\)(\.dem(\.(zst|bz2))?)$/i, "$1"); try { for (const f of JSON.parse(fs.readFileSync(process.argv[1], "utf8")).files ?? []) process.stdout.write(`${canonical(f.name)}\t${f.size}\n`) } catch {}' "$listing" > "$ARCHIVE_INDEX" || true
}

format_eta() {
  local secs="$1"
  if ((secs < 60)); then
    printf '%ds' "$secs"
  elif ((secs < 3600)); then
    printf '%dmin%02ds' $((secs / 60)) $((secs % 60))
  else
    printf '%dh%02dmin' $((secs / 3600)) $((secs % 3600 / 60))
  fi
}

progress_line() {
  local offset="$1" size="$2" started="$3"
  local elapsed rate tenths text
  elapsed=$(($(date +%s) - started))
  text="$(printf '    %d%% - %d/%d MB' \
    $((offset * 100 / size)) $((offset / 1024 / 1024)) $((size / 1024 / 1024)))"
  rate=0
  ((elapsed >= 2)) && rate=$((offset / elapsed))
  if ((rate > 0)); then
    tenths=$((rate * 10 / 1024 / 1024))
    text="$(printf '%s - %d,%d MB/s - faltam %s' "$text" \
      $((tenths / 10)) $((tenths % 10)) "$(format_eta $(((size - offset) / rate)))")"
  fi
  if [[ -t 1 ]]; then
    printf '\r\033[K%s' "$text"
  else
    printf '%s\n' "$text"
  fi
}

archive_demo() {
  local demo="$1" name="$2" size="$3" stored
  [[ "$ARCHIVE_ENABLED" == true ]] || return 0
  stored="$(canonical_name "$name")"
  if grep -Fxq "$stored"$'\t'"$size" "$ARCHIVE_INDEX" 2>/dev/null; then
    step "  a demo já está guardada no acervo"
    return 0
  fi

  local init_body="$TEMP_DIR/archive-init.json" init_response="$TEMP_DIR/archive-init-response.json"
  "$NODE" -e 'process.stdout.write(JSON.stringify({name: process.argv[1], size: Number(process.argv[2]), type: ""}))' "$stored" "$size" > "$init_body"
  local status
  status="$(post_json "$ARCHIVE/api/uploads" "$init_body" "$init_response")"
  if [[ "$status" != 200 && "$status" != 201 ]]; then
    step "  não consegui abrir o envio para o acervo (HTTP $status)"
    return 1
  fi

  local id ceiling chunk offset failures chunk_file patch_response shown started drew
  id="$(json_field id "$init_response")"
  ceiling="$(json_field chunkBytes "$init_response")"
  [[ -n "$ceiling" ]] || ceiling="$ARCHIVE_CHUNK"
  chunk="$ARCHIVE_CHUNK"
  ((chunk <= ceiling)) || chunk="$ceiling"
  chunk_file="$TEMP_DIR/archive-chunk.bin"
  patch_response="$TEMP_DIR/archive-patch.json"
  offset=0
  failures=0
  shown=0
  drew=false
  started="$(date +%s)"

  step "  guardando a demo no acervo ($((size / 1024 / 1024)) MB)..."
  while ((offset < size)); do
    (set +o pipefail; tail -c "+$((offset + 1))" "$demo" | head -c "$chunk" > "$chunk_file")
    status="$(curl --silent --show-error --request PATCH --output "$patch_response" --write-out '%{http_code}' --max-time 300 --header 'content-type: application/octet-stream' --data-binary "@$chunk_file" "$ARCHIVE/api/uploads/$id?offset=$offset" || echo 000)"
    if [[ "$status" == 200 || "$status" == 409 ]]; then
      local received
      received="$(json_field received "$patch_response")"
      if [[ -n "$received" ]] && ((received > offset)); then
        offset="$received"
        failures=0
        if [[ -t 1 ]]; then
          progress_line "$offset" "$size" "$started"
          drew=true
        elif ((offset * 10 / size > shown)); then
          shown=$((offset * 10 / size))
          progress_line "$offset" "$size" "$started"
        fi
        continue
      fi
    fi
    if ((++failures > 5)); then
      if [[ "$drew" == true ]]; then
        printf '\n'
        drew=false
      fi
      step "  o envio da demo para o acervo falhou (HTTP $status); as estatísticas já foram conferidas"
      curl --silent --output /dev/null --request DELETE "$ARCHIVE/api/uploads/$id" || true
      return 1
    fi
    sleep "$failures"
  done
  if [[ "$drew" == true ]]; then
    printf '\n'
  fi

  local done_response="$TEMP_DIR/archive-done.json"
  status="$(curl --silent --show-error --request POST --output "$done_response" --write-out '%{http_code}' --max-time 120 "$ARCHIVE/api/uploads/$id/complete" || echo 000)"
  if [[ "$status" != 200 && "$status" != 201 ]]; then
    step "  o acervo não fechou o arquivo (HTTP $status)"
    return 1
  fi
  if [[ "$(json_field duplicate "$done_response")" == true ]]; then
    step "  a demo já estava guardada no acervo"
  else
    step "  demo guardada no acervo"
  fi
  printf '%s\t%s\n' "$stored" "$size" >> "$ARCHIVE_INDEX"
}

resolve_node
SEARCH_PATHS=()
if ((${#PATHS[@]})); then
  for path in "${PATHS[@]}"; do
    add_path "$path"
  done
else
  while IFS= read -r library; do
    for game in "Counter-Strike Global Offensive" "Counter-Strike 2"; do
      add_path "$library/steamapps/common/$game/game/csgo/replays"
      add_path "$library/steamapps/common/$game/game/csgo/demos"
      add_path "$library/steamapps/common/$game/game/csgo"
    done
  done < <(steam_libraries)
  add_path "$HOME/Downloads"
fi

find_demos
if ((${#DEMOS[@]} == 0)); then
  printf '%s\n' "Não achei demos. Use --path /caminho/para/as/demos" >&2
  exit 1
fi

step "CS2 Stats - envio de demos"
step "${#DEMOS[@]} demo(s) para conferir."

resolve_site

if [[ "$WHAT_IF" == false ]]; then
  initialize_parser
fi

step "Etapa 1: processando e enviando as estatísticas..."
sent=0
updated=0
known=0
failed=0
for demo in "${DEMOS[@]}"; do
  name="$(basename "$demo")"
  size="$(stat -f '%z' "$demo")"
  megabytes=$((size / 1024 / 1024))
  step ""
  step "$name ($megabytes MB)"
  hash="$(fingerprint "$demo")"
  check_body="$TEMP_DIR/check.json"
  "$NODE" -e 'process.stdout.write(JSON.stringify({hash: process.argv[1], name: process.argv[2], size: Number(process.argv[3])}))' "$hash" "$name" "$size" > "$check_body"
  check_response="$TEMP_DIR/check-response.json"
  check_status="$(post_json "$SITE/api/upload/check" "$check_body" "$check_response")"
  if [[ "$check_status" != 200 ]]; then
    step "  falhou ao consultar o site (HTTP $check_status)"
    ((failed += 1))
    continue
  fi
  if [[ "$(json_field known "$check_response")" == true ]]; then
    step "  já está no site, nada enviado"
    ((known += 1))
    continue
  fi
  is_outdated="$(json_field outdated "$check_response")"
  if [[ "$is_outdated" == true ]]; then
    step "  já está no site, mas com dados antigos: vou reprocessar"
  fi
  if [[ "$WHAT_IF" == true ]]; then
    step "  seria processada aqui e só os números iriam para o site"
    continue
  fi
  step "  lendo a demo aqui no seu Mac..."
  record="$TEMP_DIR/record.json"
  if ! "$NODE" "$EXTRACTOR" "$demo" "$NICK" > "$record" 2> "$TEMP_DIR/parser-error.txt"; then
    reason="$(tr -d '\r' < "$TEMP_DIR/parser-error.txt" | head -n 1)"
    step "  falhou: ${reason:-o parser não conseguiu ler a demo}"
    ((failed += 1))
    continue
  fi
  payload="$TEMP_DIR/payload.json"
  if ! "$NODE" -e 'const fs = require("fs"); process.stdout.write(JSON.stringify({hash: process.argv[1], record: JSON.parse(fs.readFileSync(process.argv[2], "utf8"))}))' "$hash" "$record" > "$payload"; then
    step "  falhou: o parser devolveu um JSON inválido"
    ((failed += 1))
    continue
  fi
  step "  enviando as estatísticas..."
  send_response="$TEMP_DIR/send-response.json"
  send_status="$(post_json "$SITE/api/matches" "$payload" "$send_response")"
  if [[ "$send_status" == 200 ]]; then
    map="$(json_field map "$send_response")"
    score_a="$("$NODE" -e 'const fs = require("fs"); try { process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).score.A)) } catch {}' "$send_response")"
    score_b="$("$NODE" -e 'const fs = require("fs"); try { process.stdout.write(String(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).score.B)) } catch {}' "$send_response")"
    if [[ "$(json_field updated "$send_response")" == true ]]; then
      step "  atualizada com os dados novos: $map $score_a-$score_b"
      ((updated += 1))
    else
      step "  pronto: $map $score_a-$score_b"
      ((sent += 1))
    fi
    continue
  fi
  if [[ "$(json_field duplicate "$send_response")" == true ]]; then
    step "  essa partida já estava no site"
    ((known += 1))
    continue
  fi
  reason="$(json_field error "$send_response")"
  step "  falhou: ${reason:-erro HTTP $send_status}"
  ((failed += 1))
done

if [[ "$WHAT_IF" == false && "$ARCHIVE_ENABLED" == true ]]; then
  step ""
  step "Etapa 2: guardando as demos em $ARCHIVE..."
  archive_index
  for demo in "${DEMOS[@]}"; do
    name="$(basename "$demo")"
    size="$(stat -f '%z' "$demo")"
    step "$name"
    archive_demo "$demo" "$name" "$size" || true
  done
fi

step ""
step "Fim: $sent enviada(s), $updated atualizada(s), $known já estavam lá, $failed com erro."
