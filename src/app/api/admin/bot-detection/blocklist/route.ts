import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { addToBlocklist, removeFromBlocklist } from "@/lib/bot-detection";

const IP_REGEX = /^(\d{1,3}\.){3}\d{1,3}$/;

export async function GET() {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const dbEntries = await prisma.blockedIp.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ blocklist: dbEntries });
}

export async function POST(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { ips, reason } = await request.json();

  if (!ips || (typeof ips !== "string" && !Array.isArray(ips))) {
    return NextResponse.json({ error: "IPs required (string or array)" }, { status: 400 });
  }

  // Parse IPs: accept newline-separated string or array
  const ipList: string[] = (typeof ips === "string" ? ips.split("\n") : ips)
    .map((ip: string) => ip.trim())
    .filter((ip: string) => ip && IP_REGEX.test(ip));

  if (ipList.length === 0) {
    return NextResponse.json({ error: "No valid IP addresses found" }, { status: 400 });
  }

  // Save to DB (skip duplicates)
  let added = 0;
  for (const ip of ipList) {
    try {
      await prisma.blockedIp.create({
        data: { ip, reason: reason || null },
      });
      added++;
    } catch {
      // Duplicate — skip
    }
  }

  // Sync to Redis for O(1) lookups
  await addToBlocklist(ipList);

  return NextResponse.json({ success: true, added, total: ipList.length });
}

export async function DELETE(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { ip } = await request.json();
  if (!ip) return NextResponse.json({ error: "IP required" }, { status: 400 });

  await prisma.blockedIp.delete({ where: { ip } }).catch(() => {});
  await removeFromBlocklist(ip);

  return NextResponse.json({ success: true });
}
