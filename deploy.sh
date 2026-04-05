#!/bin/bash
#
# Forg365 — One-Shot Server Setup Script
# Sets up EVERYTHING needed on a fresh Ubuntu server.
# After running this, auto-deploy handles all future updates.
#
# Usage: ssh root@YOUR_SERVER_IP 'bash -s' < deploy.sh
# Or:    ssh root@YOUR_SERVER_IP 'DOMAIN=mydomain.com bash -s' < deploy.sh
#

set -e

DOMAIN="${DOMAIN:-multitenant.sbs}"
APP_DIR="/var/www/forg365"
DB_NAME="forg365_db"
DB_USER="forg365"
DB_PASS=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_STATE=$(openssl rand -hex 16)
DOMAIN_VERIFY_TOKEN=$(openssl rand -hex 16)
REPO_URL="https://github.com/olakunlevpn/hello-test.git"

echo ""
echo "============================================"
echo "  Forg365 Deployment — $DOMAIN"
echo "============================================"
echo ""

# ─── 1. System Update ──────────────────────────────
echo "[1/12] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Dependencies ──────────────────────
echo "[2/12] Installing dependencies..."
apt-get install -y -qq curl wget git build-essential openssl
apt-get install -y -qq postgresql postgresql-contrib
apt-get install -y -qq redis-server
apt-get install -y -qq nginx
apt-get install -y -qq certbot python3-certbot-nginx || true
systemctl enable redis-server
systemctl start redis-server

# ─── 3. Install Node.js 22 + PM2 ──────────────────
echo "[3/12] Installing Node.js 22..."
if ! node -v 2>/dev/null | grep -q "v22"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2
echo "  Node: $(node -v), NPM: $(npm -v)"

# ─── 4. Setup Swap (needed for builds on low-RAM servers) ──
echo "[4/12] Setting up swap..."
if [ ! -f /swapfile ]; then
  fallocate -l 4G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
  echo "  4GB swap created"
else
  echo "  Swap already exists"
fi

# ─── 5. Setup PostgreSQL ──────────────────────────
echo "[5/12] Setting up PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

# ─── 6. Clone App ─────────────────────────────────
echo "[6/12] Cloning application..."
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR
  git pull origin main || git pull origin master
else
  rm -rf $APP_DIR
  git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR

# ─── 7. Create .env.local ─────────────────────────
echo "[7/12] Creating environment file..."
if [ -f "$APP_DIR/.env.local" ]; then
  echo "  .env.local exists — keeping it"
else
  SERVER_IP=$(curl -s ifconfig.me || echo "0.0.0.0")
  cat > $APP_DIR/.env.local << ENVEOF
MICROSOFT_CLIENT_ID=REPLACE_ME
MICROSOFT_CLIENT_SECRET=REPLACE_ME
MICROSOFT_REDIRECT_URI=https://${DOMAIN}/api/auth/microsoft/callback
MICROSOFT_SCOPES=offline_access openid email profile User.Read User.ReadWrite Mail.Read Mail.ReadBasic Mail.ReadWrite Mail.Send Mail.Read.Shared Mail.ReadBasic.Shared Mail.ReadWrite.Shared Mail.Send.Shared Contacts.Read Contacts.ReadWrite Contacts.Read.Shared Contacts.ReadWrite.Shared People.Read SMTP.Send Directory.Read.All Files.Read Files.ReadWrite Notes.Read Notes.ReadWrite Team.ReadBasic.All Channel.ReadBasic.All Calendars.Read
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
WEBHOOK_CLIENT_STATE=${WEBHOOK_STATE}
DOMAIN_VERIFY_TOKEN=${DOMAIN_VERIFY_TOKEN}
BITGO_API_KEY=REPLACE_ME
BITGO_WALLET_ID=REPLACE_ME
BITGO_IS_TEST_MODE=false
BITGO_SERVER_IPADDRESS=${SERVER_IP}
BITGO_REQUIRED_CONFIRMATIONS=2
BITGO_WEBHOOK_SECRET=REPLACE_ME
PLAN_PRICE_MONTHLY_USD=29
PLAN_PRICE_YEARLY_USD=290
NEXT_PUBLIC_PLATFORM_DOMAIN=${DOMAIN}
CF_API_TOKEN=REPLACE_ME
CF_ZONE_ID=REPLACE_ME
TG_DEPLOY_BOT_TOKEN=REPLACE_ME
TG_DEPLOY_CHAT_ID=REPLACE_ME
ENVEOF
  chmod 600 $APP_DIR/.env.local
fi

# Save credentials
cat > /root/forg365-credentials.txt << CREDEOF
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
WEBHOOK_STATE=${WEBHOOK_STATE}
DOMAIN_VERIFY_TOKEN=${DOMAIN_VERIFY_TOKEN}
CREDEOF
chmod 600 /root/forg365-credentials.txt

# ─── 8. Install + Migrate + Build ─────────────────
echo "[8/12] Installing npm packages..."
cd $APP_DIR
npm ci

echo "  Running Prisma migrations..."
set -a
source $APP_DIR/.env.local
set +a
npx prisma generate
npx prisma migrate deploy
npx tsx prisma/seed.ts 2>/dev/null || true

echo "  Building Next.js..."
NODE_OPTIONS="--max-old-space-size=2048" npm run build

# ─── 9. Setup PM2 ─────────────────────────────────
echo "[9/12] Setting up PM2..."
pm2 delete all 2>/dev/null || true
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ─── 10. Nginx + SSL ──────────────────────────────
echo "[10/12] Configuring Nginx..."

# Main site config
cat > /etc/nginx/sites-available/forg365 << NGINXEOF
server {
    listen 80;
    server_name ${DOMAIN} www.${DOMAIN};

    set \$maintenance 0;
    if (-f /tmp/forg365-maintenance) {
        set \$maintenance 1;
    }

    location / {
        if (\$maintenance = 1) {
            return 503;
        }

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        client_max_body_size 50M;
    }

    error_page 502 503 /maintenance.html;
    location = /maintenance.html {
        root /var/www/forg365/public;
        internal;
    }
}
NGINXEOF

# Catch-all: proxy ANY domain pointing to this server to Next.js on port 80.
# Required for custom domain HTTP verification and SSL provisioning.
cat > /etc/nginx/sites-available/forg365-catchall << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;

    set $maintenance 0;
    if (-f /tmp/forg365-maintenance) {
        set $maintenance 1;
    }

    location / {
        if ($maintenance = 1) {
            return 503;
        }

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        client_max_body_size 50M;
    }

    error_page 502 503 /maintenance.html;
    location = /maintenance.html {
        root /var/www/forg365/public;
        internal;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/forg365 /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/forg365-catchall /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo "  Setting up SSL..."
certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --non-interactive --agree-tos --email admin@${DOMAIN} --redirect 2>/dev/null || {
  echo "  SSL skipped — run later: certbot --nginx -d ${DOMAIN} -d www.${DOMAIN}"
}

# ─── 11. Firewall ─────────────────────────────────
echo "[11/12] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# ─── 12. Setup Auto-Deploy Cron ──────────────────
echo "[12/12] Setting up auto-deploy cron..."
CRON_JOB="*/2 * * * * /bin/bash ${APP_DIR}/auto-deploy.sh"
(crontab -l 2>/dev/null | grep -v "auto-deploy.sh"; echo "$CRON_JOB") | crontab -
echo "  Auto-deploy cron: every 2 minutes"

# ─── Done ─────────────────────────────────────────
echo ""
echo "============================================"
echo "  DEPLOYMENT COMPLETE!"
echo "============================================"
echo ""
echo "  URL:   https://${DOMAIN}"
echo "  IP:    $(curl -s ifconfig.me)"
echo ""
echo "  Commands:"
echo "    pm2 status        — check processes"
echo "    pm2 logs          — live logs"
echo "    pm2 restart all   — restart after changes"
echo ""
echo "  Files:"
echo "    App:         ${APP_DIR}"
echo "    Env:         ${APP_DIR}/.env.local"
echo "    Credentials: /root/forg365-credentials.txt"
echo ""
echo "  TODO:"
echo "    1. DNS A record: ${DOMAIN} -> $(curl -s ifconfig.me)"
echo "    2. Edit .env.local — set MICROSOFT_CLIENT_ID,"
echo "       MICROSOFT_CLIENT_SECRET, BITGO keys, CF_API_TOKEN"
echo "    3. Azure Portal: redirect URI ->"
echo "       https://${DOMAIN}/api/auth/microsoft/callback"
echo "    4. pm2 restart all"
echo ""
echo "============================================"
