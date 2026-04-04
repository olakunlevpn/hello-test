import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import dns from "dns/promises";

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

  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs";

  try {
    // Check CNAME record
    let cnameMatch = false;
    try {
      const cnames = await dns.resolveCname(domain.domain);
      cnameMatch = cnames.some((c) => c.toLowerCase().includes(platformDomain.toLowerCase()));
    } catch {
      // No CNAME — check A record pointing to our server IP
    }

    // Check A record as fallback
    let aMatch = false;
    if (!cnameMatch) {
      try {
        const serverIp = process.env.BITGO_SERVER_IPADDRESS || "";
        const aRecords = await dns.resolve4(domain.domain);
        aMatch = aRecords.includes(serverIp);
      } catch {
        // No A record either
      }
    }

    const verified = cnameMatch || aMatch;

    await prisma.customDomain.update({
      where: { id },
      data: { verified },
    });

    return NextResponse.json({
      verified,
      method: cnameMatch ? "CNAME" : aMatch ? "A" : "NONE",
      message: verified
        ? "Domain verified successfully"
        : `DNS not pointing to ${platformDomain}. Add a CNAME record pointing to ${platformDomain} or an A record pointing to your server IP.`,
    });
  } catch {
    return NextResponse.json({ error: "DNS verification failed" }, { status: 500 });
  }
}
