#!/usr/bin/env bash
set -euo pipefail

SITE_USER="engagebyelevate-online"

if [ "$(id -un)" != "$SITE_USER" ]; then
  if [ "$(id -u)" = "0" ]; then
    exec sudo -u "$SITE_USER" -- "$0" "$@"
  fi
  echo "deploy-online must be run as $SITE_USER (you are $(id -un))." >&2
  exit 1
fi

cd "$(dirname "$(readlink -f "$0")")/.."

git pull

rsync -av --delete --exclude='.git' --exclude='.well-known/' public/ /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/

find /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/ -type d -exec chmod 755 {} +
find /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/ -type f -exec chmod 644 {} +

echo "Deployed. Visit: https://online.engagebyelevate.com"
