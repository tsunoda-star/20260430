#!/usr/bin/env bash
# Pro-Web (Plesk Node.js) デプロイスクリプト.
# SSH ログイン後、リポジトリルートで実行する想定:
#   cd ~/httpdocs/sct
#   ./scripts/proweb-deploy.sh
#
# 既に Plesk Node.js Toolkit が有効化済み + 環境変数設定済み + Application Startup
# File が `.next/standalone/server.js` になっていることが前提。
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> [1/5] git pull"
git fetch --all --prune
git checkout main
git pull --ff-only

echo "==> [2/5] npm ci"
npm ci

echo "==> [3/5] PDF Japanese fonts"
npm run setup:fonts

echo "==> [4/5] next build (standalone)"
NODE_ENV=production npm run build

echo "==> [4.5/5] copy static + public into standalone"
# Next.js standalone は .next/static / public を別途同梱する必要がある
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/

echo "==> [5/5] graceful restart (Phusion Passenger)"
mkdir -p tmp
touch tmp/restart.txt

echo
echo "✓ deploy completed."
echo "  health: curl https://checklist.secureonline.co.jp/api/v1/health"
