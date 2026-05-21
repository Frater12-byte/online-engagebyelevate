#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

git pull

rsync -av --delete --exclude='.git' --exclude='.well-known/' public/ /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/

find /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/ -type d -exec chmod 755 {} +
find /home/engagebyelevate-online/htdocs/online.engagebyelevate.com/ -type f -exec chmod 644 {} +

echo "Deployed. Visit: https://online.engagebyelevate.com"
