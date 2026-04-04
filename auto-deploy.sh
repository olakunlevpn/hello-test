#!/bin/bash

# ============================================
# Forg365 — Auto Deploy Script (runs via cron)
# Checks GitHub every 2 minutes
# Only deploys if new changes detected
# ============================================
BRANCH="main"
CF_ZONE_ID="095c3aef0023e74e3a554646979562cf"

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LOG_DIR="${LOG_DIR:-$PROJECT_DIR/logs}"

mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/auto-deploy.log"

cd "$PROJECT_DIR"

git fetch origin "$BRANCH" --quiet

LOCAL=$(git rev-parse HEAD)
REMOTE=$(git rev-parse "origin/$BRANCH")

if [ "$LOCAL" = "$REMOTE" ]; then
    exit 0
fi

echo "" >> "$LOG_FILE"
echo "=== Auto-deploy started at $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG_FILE"
echo "Local:  $LOCAL" >> "$LOG_FILE"
echo "Remote: $REMOTE" >> "$LOG_FILE"

exec >> "$LOG_FILE" 2>&1

# ALWAYS remove maintenance file on exit — even if script fails
cleanup() {
    rm -f /tmp/forg365-maintenance
    echo "  Maintenance mode disabled"
}
trap cleanup EXIT

# Source env
set -a
source "$PROJECT_DIR/.env.local"
set +a

echo "[1/7] Enabling maintenance mode..."
touch /tmp/forg365-maintenance

echo "[2/7] Pulling changes..."
git stash 2>/dev/null || true
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "[3/7] Checking npm packages..."
if git diff HEAD@{1} --name-only 2>/dev/null | grep -q "package-lock.json"; then
    npm ci
    echo "  npm ci completed"
else
    echo "  No package changes, skipping"
fi

echo "[4/7] Running Prisma migrations + seed..."
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts 2>/dev/null || true

echo "[5/7] Building Next.js..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build

echo "[6/7] Restarting PM2..."
pm2 restart ecosystem.config.cjs --update-env 2>/dev/null || pm2 start ecosystem.config.cjs
pm2 save

echo "[7/7] Purging Cloudflare cache..."
if [ -n "$CF_API_TOKEN" ]; then
    curl -s -X POST "https://api.cloudflare.com/client/v4/zones/$CF_ZONE_ID/purge_cache" \
        -H "Authorization: Bearer $CF_API_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{"purge_everything":true}' | grep -o '"success":[a-z]*'
else
    echo "  CF_API_TOKEN not set, skipping"
fi

echo "=== Auto-deploy completed at $(date '+%Y-%m-%d %H:%M:%S') ==="

# ============================================
# Telegram Deploy Notification
# Bot: @kunledeploy_bot
# ============================================
TG_BOT="8725383408:AAFRWW7t1SopjZFIxwgNTq5rFu0Vj-wtpzw"
TG_CHAT="6113315629"
TG_HOST=$(hostname 2>/dev/null || echo "unknown")
TG_IP=$(hostname -I 2>/dev/null | awk '{print $1}' || echo "unknown")
TG_COMMIT=$(git log -1 --pretty=format:'%h %s' 2>/dev/null || echo "unknown")
TG_DOMAIN=$(basename "$PWD")

curl -s -X POST "https://api.telegram.org/bot${TG_BOT}/sendMessage" \
  --data-urlencode "chat_id=${TG_CHAT}" \
  --data-urlencode "parse_mode=HTML" \
  --data-urlencode "text=<b>Auto-Deploy Complete</b>
<b>Domain:</b> ${TG_DOMAIN}
<b>Server:</b> ${TG_HOST} (${TG_IP})
<b>Commit:</b> <code>${TG_COMMIT}</code>" > /dev/null 2>&1 || true
