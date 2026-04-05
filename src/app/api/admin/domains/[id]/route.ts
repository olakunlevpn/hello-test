import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { execSync } from "child_process";

export async function DELETE(
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

  // Clean up Nginx config
  if (domain.sslActive) {
    const domainName = domain.domain.replace(/[^a-zA-Z0-9.-]/g, "");
    try {
      execSync(`rm -f /etc/nginx/sites-enabled/custom-${domainName}`);
      execSync(`rm -f /etc/nginx/sites-available/custom-${domainName}`);
      execSync("nginx -t && systemctl reload nginx");
    } catch { /* non-critical */ }
  }

  await prisma.customDomain.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
