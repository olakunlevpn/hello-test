import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import dns from "dns/promises";

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

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs";

  try {
    let cnameMatch = false;
    try {
      const cnames = await dns.resolveCname(domain.domain);
      cnameMatch = cnames.some((c) => c.toLowerCase().includes(platformDomain.toLowerCase()));
    } catch { /* no CNAME */ }

    let aMatch = false;
    if (!cnameMatch) {
      try {
        const serverIp = process.env.BITGO_SERVER_IPADDRESS || "";
        const aRecords = await dns.resolve4(domain.domain);
        aMatch = aRecords.includes(serverIp);
      } catch { /* no A record */ }
    }

    const verified = cnameMatch || aMatch;
    await prisma.customDomain.update({ where: { id }, data: { verified } });

    return NextResponse.json({
      verified,
      method: cnameMatch ? "CNAME" : aMatch ? "A" : "NONE",
      message: verified
        ? "Domain verified successfully"
        : `DNS not pointing to server. Add an A record pointing to your server IP or a CNAME to ${platformDomain}.`,
    });
  } catch {
    return NextResponse.json({ error: "DNS verification failed" }, { status: 500 });
  }
}
