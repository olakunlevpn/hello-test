import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { execSync } from "child_process";

export async function DELETE(
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

  const domain = await prisma.customDomain.findFirst({
    where: { id, userId },
  });

  if (!domain) {
    return NextResponse.json({ error: "Domain not found" }, { status: 404 });
  }

  // Clean up Nginx config if SSL was provisioned
  if (domain.sslActive) {
    const domainName = domain.domain.replace(/[^a-zA-Z0-9.-]/g, "");
    try {
      execSync(`rm -f /etc/nginx/sites-enabled/custom-${domainName}`);
      execSync(`rm -f /etc/nginx/sites-available/custom-${domainName}`);
      execSync("nginx -t && systemctl reload nginx");
    } catch {
      // Nginx cleanup failed — non-critical, continue with delete
    }
  }

  await prisma.customDomain.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
