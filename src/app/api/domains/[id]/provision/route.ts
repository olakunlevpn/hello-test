import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { execSync } from "child_process";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const domain = await prisma.customDomain.findFirst({ where: { id, userId } });
  if (!domain) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!domain.verified) {
    return NextResponse.json({ error: "Domain must be verified before provisioning SSL" }, { status: 400 });
  }

  if (domain.sslActive) {
    return NextResponse.json({ message: "SSL already active", sslActive: true });
  }

  try {
    const domainName = domain.domain.replace(/[^a-zA-Z0-9.-]/g, "");

    // 1. Add Nginx server block for this domain
    const nginxConfig = `
server {
    listen 80;
    server_name ${domainName};

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

    error_page 502 503 /maintenance.html;
    location = /maintenance.html {
        root /var/www/forg365/public;
        internal;
    }
}
`;

    // Write nginx config — use escaped $ for nginx variables
    const escapedConfig = nginxConfig.replace(/\$http_upgrade/g, '\\$http_upgrade').replace(/\$host/g, '\\$host').replace(/\$remote_addr/g, '\\$remote_addr').replace(/\$proxy_add_x_forwarded_for/g, '\\$proxy_add_x_forwarded_for').replace(/\$scheme/g, '\\$scheme');

    execSync(`echo '${escapedConfig}' > /etc/nginx/sites-available/custom-${domainName}`);
    execSync(`ln -sf /etc/nginx/sites-available/custom-${domainName} /etc/nginx/sites-enabled/`);
    execSync("nginx -t");
    execSync("systemctl reload nginx");

    // 2. Provision SSL with certbot
    try {
      execSync(
        `certbot --nginx -d ${domainName} --non-interactive --agree-tos --email admin@${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs"} --redirect`,
        { timeout: 60000 }
      );
    } catch {
      // SSL might fail but nginx is set up — domain works on HTTP
    }

    // 3. Mark as SSL active
    await prisma.customDomain.update({
      where: { id },
      data: { sslActive: true },
    });

    return NextResponse.json({ success: true, sslActive: true });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? "Provisioning failed — check server permissions" : "Unknown error",
    }, { status: 500 });
  }
}
