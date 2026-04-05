import "./env";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dns from "dns/promises";
import { execSync } from "child_process";
import fs from "fs";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs";
const VERIFY_TOKEN = process.env.DOMAIN_VERIFY_TOKEN || "forg365-domain-active";

async function verifyViaHttp(domain: string): Promise<boolean> {
  for (const protocol of ["https", "http"]) {
    try {
      const res = await fetch(`${protocol}://${domain}/api/domain-verify`, {
        signal: AbortSignal.timeout(8000),
        redirect: "follow",
      });
      if (!res.ok) continue;
      const data = await res.json();
      if (data.token === VERIFY_TOKEN) return true;
    } catch {
      continue;
    }
  }
  return false;
}

async function checkDomainDns(domain: string): Promise<{ verified: boolean; method: string }> {
  // Method 1: HTTP verification — works through Cloudflare proxy and CDNs
  const httpOk = await verifyViaHttp(domain);
  if (httpOk) return { verified: true, method: "HTTP" };

  // Method 2: CNAME
  try {
    const cnames = await dns.resolveCname(domain);
    if (cnames.some((c) => c.toLowerCase().includes(platformDomain.toLowerCase()))) {
      return { verified: true, method: "CNAME" };
    }
  } catch { /* no CNAME */ }

  // Method 3: A record
  try {
    const serverIp = process.env.BITGO_SERVER_IPADDRESS || "";
    if (serverIp) {
      const aRecords = await dns.resolve4(domain);
      if (aRecords.includes(serverIp)) {
        return { verified: true, method: "A" };
      }
    }
  } catch { /* no A record */ }

  return { verified: false, method: "NONE" };
}

function provisionNginxAndSsl(domainName: string): boolean {
  const d = domainName.replace(/[^a-zA-Z0-9.-]/g, "");
  const configPath = `/etc/nginx/sites-available/custom-${d}`;

  // Skip if already provisioned
  if (fs.existsSync(configPath)) return true;

  try {
    const config = `server {
    listen 80;
    server_name ${d};

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
`;

    fs.writeFileSync(configPath, config);
    execSync(`ln -sf ${configPath} /etc/nginx/sites-enabled/`);
    execSync("nginx -t");
    execSync("systemctl reload nginx");

    // SSL
    try {
      execSync(
        `certbot --nginx -d ${d} --non-interactive --agree-tos --email admin@${platformDomain} --redirect`,
        { timeout: 60000 }
      );
    } catch {
      console.log(`[domain-worker] SSL failed for ${d} — HTTP works`);
    }

    return true;
  } catch (err) {
    console.error(`[domain-worker] Nginx provision failed for ${d}:`, err instanceof Error ? err.message : err);
    return false;
  }
}

const worker = new Worker(
  "domain-check",
  async (job) => {
    console.log(`[domain-worker] Job: ${job.name} (${job.id})`);

    // Get all unverified domains
    const unverifiedDomains = await prisma.customDomain.findMany({
      where: { verified: false },
    });

    // Get all verified but no SSL domains
    const needsSsl = await prisma.customDomain.findMany({
      where: { verified: true, sslActive: false },
    });

    console.log(`[domain-worker] ${unverifiedDomains.length} unverified, ${needsSsl.length} need SSL`);

    // Check DNS for unverified domains
    for (const domain of unverifiedDomains) {
      const result = await checkDomainDns(domain.domain);
      if (result.verified) {
        await prisma.customDomain.update({
          where: { id: domain.id },
          data: { verified: true },
        });
        console.log(`[domain-worker] ${domain.domain} verified via ${result.method}`);

        // Auto-provision Nginx + SSL
        const provisioned = provisionNginxAndSsl(domain.domain);
        if (provisioned) {
          await prisma.customDomain.update({
            where: { id: domain.id },
            data: { sslActive: true },
          });
          console.log(`[domain-worker] ${domain.domain} SSL provisioned`);
        }
      }
    }

    // Provision SSL for verified domains that don't have it yet
    for (const domain of needsSsl) {
      const provisioned = provisionNginxAndSsl(domain.domain);
      if (provisioned) {
        await prisma.customDomain.update({
          where: { id: domain.id },
          data: { sslActive: true },
        });
        console.log(`[domain-worker] ${domain.domain} SSL provisioned`);
      }
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`Domain check job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
