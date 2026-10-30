#!/bin/sh
set -e

host="${SELFHOST_SSH:?defina SELFHOST_SSH=usuario@host no .env.local}"
local_port="${SELFHOST_DB_PORT:-5433}"
remote_port="${SELFHOST_DB_REMOTE_PORT:-5432}"

echo "postgres do self-host em 127.0.0.1:$local_port (ctrl-c encerra)"
exec ssh -o ExitOnForwardFailure=yes -N -L "$local_port:127.0.0.1:$remote_port" "$host"
