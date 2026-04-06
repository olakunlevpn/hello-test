import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { addToBlocklist, removeFromBlocklist } from "@/lib/bot-detection";
import { isIP } from "net";

export async function GET(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 200));
  const search = url.searchParams.get("search")?.trim() || "";
  const skip = (page - 1) * limit;

  const where = search ? { ip: { contains: search } } : {};

  try {
    const [blocklist, total] = await Promise.all([
      prisma.blockedIp.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.blockedIp.count({ where }),
    ]);
    return NextResponse.json({ blocklist, total, page, limit });
  } catch {
    return NextResponse.json({ error: "Failed to load blocklist" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { ips, reason } = body;

  if (!ips || (typeof ips !== "string" && !Array.isArray(ips))) {
    return NextResponse.json({ error: "IPs required (string or array)" }, { status: 400 });
  }

  const ipList: string[] = (typeof ips === "string" ? ips.split("\n") : ips)
    .map((ip: string) => ip.trim())
    .filter((ip: string) => ip && isIP(ip) !== 0);

  if (ipList.length === 0) {
    return NextResponse.json({ error: "No valid IP addresses found" }, { status: 400 });
  }

  try {
    let added = 0;
    for (const ip of ipList) {
      try {
        await prisma.blockedIp.create({ data: { ip, reason: reason || null } });
        added++;
      } catch { /* duplicate — skip */ }
    }

    await addToBlocklist(ipList);
    return NextResponse.json({ success: true, added, total: ipList.length });
  } catch {
    return NextResponse.json({ error: "Failed to add IPs" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { ip } = body;
  if (!ip) return NextResponse.json({ error: "IP required" }, { status: 400 });

  await prisma.blockedIp.delete({ where: { ip } }).catch(() => {});
  await removeFromBlocklist(ip);

  return NextResponse.json({ success: true });
}
