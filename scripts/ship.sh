#!/bin/sh
set -e

host="${SELFHOST_SSH:?defina SELFHOST_SSH=usuario@host no .env.local}"

echo "==> commit"
git add -A
git commit --amend --no-edit

echo "==> push"
git push --force origin main
git reflog expire --expire=now --expire-unreachable=now --all
git gc --prune=now --quiet

echo "==> deploy em $host"
ssh "$host" 'sh ~/deploy-cs2stats.sh'
