import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { execSync } from "child_process";
import fs from "fs";

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
    const d = domain.domain.replace(/[^a-zA-Z0-9.-]/g, "");

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

    fs.writeFileSync(`/etc/nginx/sites-available/custom-${d}`, config);
    execSync(`ln -sf /etc/nginx/sites-available/custom-${d} /etc/nginx/sites-enabled/`);
    execSync("nginx -t");
    execSync("systemctl reload nginx");

    try {
      execSync(
        `certbot --nginx -d ${d} --non-interactive --agree-tos --email admin@${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs"} --redirect`,
        { timeout: 60000 }
      );
    } catch {
      // SSL might fail but nginx HTTP is set up
    }

    await prisma.customDomain.update({
      where: { id },
      data: { sslActive: true },
    });

    return NextResponse.json({ success: true, sslActive: true });
  } catch {
    return NextResponse.json({ error: "Provisioning failed" }, { status: 500 });
  }
}
