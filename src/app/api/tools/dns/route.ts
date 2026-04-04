import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import dns from "dns/promises";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domain = request.nextUrl.searchParams.get("domain");
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  try {
    const results: Record<string, unknown> = {};
    const lookups = [
      { type: "A", fn: () => dns.resolve4(domain) },
      { type: "AAAA", fn: () => dns.resolve6(domain) },
      { type: "MX", fn: () => dns.resolveMx(domain) },
      { type: "TXT", fn: () => dns.resolveTxt(domain) },
      { type: "NS", fn: () => dns.resolveNs(domain) },
      { type: "CNAME", fn: () => dns.resolveCname(domain) },
    ];

    for (const lookup of lookups) {
      try {
        results[lookup.type] = await lookup.fn();
      } catch {
        results[lookup.type] = [];
      }
    }

    return NextResponse.json({ domain, records: results });
  } catch {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }
}
