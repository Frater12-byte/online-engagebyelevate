#!/usr/bin/env bash
set -euo pipefail
SITE_USER="engagebyelevate-online"
REPO="/home/engagebyelevate-online/online-engagebyelevate"

if [ "$(id -un)" != "$SITE_USER" ]; then
  if [ "$(id -u)" = "0" ]; then
    exec sudo -u "$SITE_USER" -- "$0" "$@"
  fi
  echo "deploy-online must be run as $SITE_USER (you are $(id -un))." >&2
  exit 1
fi

cd "$REPO"
git pull
exec "$REPO/scripts/deploy-online.sh"
