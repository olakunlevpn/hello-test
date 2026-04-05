#!/bin/bash
#
# Forg365 — One-Shot Deployment Script
# Domain: multitenant.sbs
#
# Usage: ssh root@YOUR_SERVER_IP 'bash -s' < deploy.sh
#

set -e

DOMAIN="multitenant.sbs"
APP_DIR="/var/www/forg365"
DB_NAME="forg365_db"
DB_USER="forg365"
DB_PASS=$(openssl rand -hex 16)
NEXTAUTH_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)
WEBHOOK_STATE=$(openssl rand -hex 16)
REPO_URL="https://github.com/olakunlevpn/hello-test.git"

echo ""
echo "============================================"
echo "  Forg365 Deployment — $DOMAIN"
echo "============================================"
echo ""

# ─── 1. System Update ──────────────────────────────
echo "[1/10] Updating system..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get upgrade -y -qq

# ─── 2. Install Dependencies ──────────────────────
echo "[2/10] Installing dependencies..."
apt-get install -y -qq curl wget git build-essential openssl
apt-get install -y -qq postgresql postgresql-contrib
apt-get install -y -qq redis-server
apt-get install -y -qq nginx
apt-get install -y -qq certbot python3-certbot-nginx || true
systemctl enable redis-server
systemctl start redis-server

# ─── 3. Install Node.js 22 + PM2 ──────────────────
echo "[3/10] Installing Node.js 22..."
if ! node -v 2>/dev/null | grep -q "v22"; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y -qq nodejs
fi
npm install -g pm2
echo "  Node: $(node -v), NPM: $(npm -v)"

# ─── 4. Setup PostgreSQL ──────────────────────────
echo "[4/10] Setting up PostgreSQL..."
systemctl enable postgresql
systemctl start postgresql
sudo -u postgres psql -tc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE USER ${DB_USER} WITH PASSWORD '${DB_PASS}';"
sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres psql -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER};"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${DB_NAME} TO ${DB_USER};" 2>/dev/null || true

# ─── 5. Clone App ─────────────────────────────────
echo "[5/10] Cloning application..."
if [ -d "$APP_DIR/.git" ]; then
  cd $APP_DIR
  git pull origin main || git pull origin master
else
  rm -rf $APP_DIR
  git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR

# ─── 6. Create .env.local ─────────────────────────
echo "[6/10] Creating environment file..."
if [ -f "$APP_DIR/.env.local" ]; then
  echo "  .env.local exists — keeping it"
else
  SERVER_IP=$(curl -s ifconfig.me || echo "0.0.0.0")
  cat > $APP_DIR/.env.local << ENVEOF
MICROSOFT_CLIENT_ID=REPLACE_ME
MICROSOFT_CLIENT_SECRET=REPLACE_ME
MICROSOFT_REDIRECT_URI=https://${DOMAIN}/api/auth/microsoft/callback
MICROSOFT_SCOPES="offline_access openid email profile User.Read User.ReadWrite Mail.Read Mail.ReadBasic Mail.ReadWrite Mail.Send Mail.Read.Shared Mail.ReadBasic.Shared Mail.ReadWrite.Shared Mail.Send.Shared Contacts.Read Contacts.ReadWrite Contacts.Read.Shared Contacts.ReadWrite.Shared People.Read SMTP.Send Directory.Read.All"
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
REDIS_URL=redis://localhost:6379
NEXTAUTH_URL=https://${DOMAIN}
NEXTAUTH_SECRET=${NEXTAUTH_SECRET}
ENCRYPTION_KEY=${ENCRYPTION_KEY}
WEBHOOK_CLIENT_STATE=${WEBHOOK_STATE}
BITGO_API_KEY=REPLACE_ME
BITGO_WALLET_ID=REPLACE_ME
BITGO_IS_TEST_MODE=false
BITGO_SERVER_IPADDRESS=${SERVER_IP}
BITGO_REQUIRED_CONFIRMATIONS=2
BITGO_WEBHOOK_SECRET=REPLACE_ME
PLAN_PRICE_MONTHLY_USD=29
PLAN_PRICE_YEARLY_USD=290
NEXT_PUBLIC_PLATFORM_DOMAIN=${DOMAIN}
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
CREDEOF
chmod 600 /root/forg365-credentials.txt

# ─── 7. Install + Migrate + Build ─────────────────
echo "[7/10] Installing npm packages..."
cd $APP_DIR
npm ci

echo "  Running Prisma migrations..."
set -a
source $APP_DIR/.env.local
set +a
npx prisma generate
npx prisma migrate deploy

echo "  Building Next.js..."
npm run build

# ─── 8. Setup PM2 ─────────────────────────────────
echo "[8/10] Setting up PM2..."
cat > $APP_DIR/ecosystem.config.cjs << 'PM2EOF'
const fs = require("fs");
const path = require("path");
function loadEnv() {
  const vars = {};
  const cwd = "/var/www/forg365";
  for (const f of [".env", ".env.local"]) {
    const fp = path.join(cwd, f);
    if (fs.existsSync(fp)) {
      for (const line of fs.readFileSync(fp, "utf-8").split("\n")) {
        const m = line.match(/^([^#=]+)=(.*)$/);
        if (m) vars[m[1].trim()] = m[2].trim();
      }
    }
  }
  return vars;
}
const env = loadEnv();
module.exports = {
  apps: [
    {
      name: "forg365-web",
      script: "node_modules/.bin/next",
      args: "start -p 3000",
      cwd: "/var/www/forg365",
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "1G",
    },
    {
      name: "forg365-token-worker",
      script: "node_modules/.bin/tsx",
      args: "src/workers/token-refresh.worker.ts",
      cwd: "/var/www/forg365",
      interpreter: "none",
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "512M",
    },
    {
      name: "forg365-webhook-worker",
      script: "node_modules/.bin/tsx",
      args: "src/workers/webhook.worker.ts",
      cwd: "/var/www/forg365",
      interpreter: "none",
      env: { NODE_ENV: "production", ...env },
      autorestart: true,
      max_memory_restart: "512M",
    },
  ],
};
PM2EOF

pm2 delete all 2>/dev/null || true
pm2 start $APP_DIR/ecosystem.config.cjs
pm2 save
pm2 startup systemd -u root --hp /root 2>/dev/null || true

# ─── 9. Nginx + SSL ───────────────────────────────
echo "[9/10] Configuring Nginx..."
cat > /etc/nginx/sites-available/forg365 << 'NGINXEOF'
server {
    listen 80;
    server_name multitenant.sbs www.multitenant.sbs;
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
        client_max_body_size 50M;
    }
}
NGINXEOF

# Catch-all: proxy ANY domain pointing to this server to Next.js on port 80.
# Required for custom domain HTTP verification before SSL provisioning.
cat > /etc/nginx/sites-available/forg365-catchall << 'NGINXEOF'
server {
    listen 80 default_server;
    server_name _;

    location / {
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

# ─── 10. Firewall ─────────────────────────────────
echo "[10/10] Configuring firewall..."
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

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
echo "    1. DNS A record: ${DOMAIN} → $(curl -s ifconfig.me)"
echo "    2. Edit .env.local — set MICROSOFT_CLIENT_ID,"
echo "       MICROSOFT_CLIENT_SECRET, BITGO keys"
echo "    3. Azure Portal: redirect URI →"
echo "       https://${DOMAIN}/api/auth/microsoft/callback"
echo "    4. pm2 restart all"
echo ""
echo "============================================"
