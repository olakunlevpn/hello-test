import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import dns from "dns/promises";

const VERIFY_TOKEN = process.env.DOMAIN_VERIFY_TOKEN || "forg365-domain-active";

async function verifyViaHttp(domain: string): Promise<boolean> {
  // Try HTTPS first (works when Cloudflare provides the cert)
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

async function verifyViaDns(domain: string): Promise<{ verified: boolean; method: string }> {
  const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs";

  // Check CNAME
  try {
    const cnames = await dns.resolveCname(domain);
    if (cnames.some((c) => c.toLowerCase().includes(platformDomain.toLowerCase()))) {
      return { verified: true, method: "CNAME" };
    }
  } catch { /* no CNAME */ }

  // Check A record
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

  try {
    // Method 1: HTTP verification — works through Cloudflare proxy and CDNs
    const httpVerified = await verifyViaHttp(domain.domain);
    if (httpVerified) {
      await prisma.customDomain.update({ where: { id }, data: { verified: true } });
      return NextResponse.json({
        verified: true,
        method: "HTTP",
        message: "Domain verified successfully",
      });
    }

    // Method 2: DNS verification — works for direct A/CNAME without proxy
    const dnsResult = await verifyViaDns(domain.domain);
    if (dnsResult.verified) {
      await prisma.customDomain.update({ where: { id }, data: { verified: true } });
      return NextResponse.json({
        verified: true,
        method: dnsResult.method,
        message: "Domain verified successfully",
      });
    }

    const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "multitenant.sbs";
    return NextResponse.json({
      verified: false,
      method: "NONE",
      message: `Domain not pointing to server. Add a CNAME to ${platformDomain} or an A record to your server IP, then ensure the domain resolves to this server.`,
    });
  } catch {
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}
