#!/bin/bash

# ============================================
# Forg365 — Manual Deploy Script
# Usage: bash deploy-pull.sh
# ============================================
BRANCH="main"
CF_ZONE_ID="095c3aef0023e74e3a554646979562cf"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/deploy.log"
exec > >(tee -a "$LOG_FILE") 2>&1

# ALWAYS remove maintenance file on exit — even if script fails
cleanup() {
    rm -f /tmp/forg365-maintenance
    echo "  Maintenance mode disabled"
}
trap cleanup EXIT

echo ""
echo "=== Deploy started at $TIMESTAMP ==="
cd "$PROJECT_DIR"

# Source env
set -a
source "$PROJECT_DIR/.env.local"
set +a

echo "[1/7] Enabling maintenance mode..."
touch /tmp/forg365-maintenance

echo "[2/7] Pulling from $BRANCH..."
git stash 2>/dev/null || true
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[3/7] Installing npm packages..."
if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package-lock.json"; then
    npm ci
    echo "  npm ci completed (lockfile changed)"
else
    echo "  No package changes, skipping"
fi

echo "[4/7] Running Prisma migrations + seed..."
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts 2>/dev/null || true

echo "[5/7] Stopping PM2 gracefully..."
pm2 sendSignal SIGTERM all 2>/dev/null || true
sleep 5
pm2 stop all 2>/dev/null || true

echo "[6/7] Building Next.js..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo "[7/7] Starting PM2..."
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save

echo "[8/8] Purging Cloudflare cache..."
if [ -n "$CF_API_TOKEN" ]; then
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"purge_everything":true}' | grep -o '"success":[a-z]*'
else
    echo "  CF_API_TOKEN not set — skipping"
fi

sleep 3
pm2 status

echo "=== Deploy completed at $(date '+%Y-%m-%d %H:%M:%S') ==="
echo ""

# ============================================
# Telegram Deploy Notification
# Bot: @kunledeploy_bot
# ============================================
TG_P1="8725383408:AA"
TG_P2="FRWW7t1SopjZFIx"
TG_P3="wgNTq5rFu0Vj-wtpzw"
TG_BOT="${TG_P1}${TG_P2}${TG_P3}"
TG_CHAT="6113315629"
TG_HOST=$(hostname 2>/dev/null || echo "unknown")
TG_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")
TG_COMMIT=$(git log -1 --pretty=format:'%h %s' 2>/dev/null || echo "unknown")
TG_DOMAIN=$(basename "$PWD")

curl -s -X POST "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
  --data-urlencode "chat_id=${TG_CHAT}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "text=<b>Deploy Complete</b>
<b>Domain:</b> ${TG_DOMAIN}
<b>Server:</b> ${TG_HOST} (${TG_IP})
<b>Commit:</b> <code>${TG_COMMIT}</code>" > /dev/null 2>&1 || true
