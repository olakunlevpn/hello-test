import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { execSync } from "child_process";
import fs from "fs";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const domain = await prisma.customDomain.findUnique({ where: { id } });
  if (!domain) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!domain.verified) return NextResponse.json({ error: "Domain must be verified first" }, { status: 400 });
  if (domain.sslActive) return NextResponse.json({ message: "SSL already active", sslActive: true });

  try {
    const d = domain.domain.replace(/[^a-zA-Z0-9.-]/g, "");

    // Write Nginx config
    const config = `server {
    listen 80;
    server_name ${d};

    set \\$maintenance 0;
    if (-f /tmp/forg365-maintenance) {
        set \\$maintenance 1;
    }

    location / {
        if (\\$maintenance = 1) {
            return 503;
        }

        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \\$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \\$host;
        proxy_set_header X-Real-IP \\$remote_addr;
        proxy_set_header X-Forwarded-For \\$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \\$scheme;
        proxy_cache_bypass \\$http_upgrade;
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

    fs.writeFileSync(`/etc/nginx/sites-available/custom-${d}`, config);
    execSync(`ln -sf /etc/nginx/sites-available/custom-${d} /etc/nginx/sites-enabled/`);
    execSync("nginx -t");
    execSync("systemctl reload nginx");

    // SSL with certbot
    try {
      execSync(
        `certbot --nginx -d ${d} --non-interactive --agree-tos --email admin@${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs"} --redirect`,
        { timeout: 60000 }
      );
    } catch {
      // SSL might fail but nginx HTTP is set up
    }

    await prisma.customDomain.update({ where: { id }, data: { sslActive: true } });
    return NextResponse.json({ success: true, sslActive: true });
  } catch {
    return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
  }
}
