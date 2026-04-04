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

echo "[4/7] Running Prisma migrations..."
npx prisma generate
npx prisma migrate deploy

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
    echo "  CF_API_TOKEN not set — skipping"
fi

sleep 3
pm2 status

echo "=== Deploy completed at $(date '+%Y-%m-%d %H:%M:%S') ==="
echo ""
