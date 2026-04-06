import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);
  const monthStart = new Date(todayStart);
  monthStart.setDate(monthStart.getDate() - 30);

  try {
  const [blockedToday, blockedWeek, blockedMonth, topIps, topCountries, reasonBreakdown] = await Promise.all([
    prisma.botLog.count({ where: { action: "blocked", createdAt: { gte: todayStart } } }),
    prisma.botLog.count({ where: { action: "blocked", createdAt: { gte: weekStart } } }),
    prisma.botLog.count({ where: { action: "blocked", createdAt: { gte: monthStart } } }),
    prisma.botLog.groupBy({
      by: ["ip"],
      where: { action: "blocked", createdAt: { gte: monthStart } },
      _count: { ip: true },
      orderBy: { _count: { ip: "desc" } },
      take: 10,
    }),
    prisma.botLog.groupBy({
      by: ["country"],
      where: { action: "blocked", createdAt: { gte: monthStart }, country: { not: null } },
      _count: { country: true },
      orderBy: { _count: { country: "desc" } },
      take: 10,
    }),
    prisma.botLog.groupBy({
      by: ["reason"],
      where: { action: "blocked", createdAt: { gte: monthStart } },
      _count: { reason: true },
      orderBy: { _count: { reason: "desc" } },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    blockedToday,
    blockedWeek,
    blockedMonth,
    topIps: topIps.map((r) => ({ ip: r.ip, count: r._count.ip })),
    topCountries: topCountries.map((r) => ({ country: r.country, count: r._count.country })),
    reasonBreakdown: reasonBreakdown.map((r) => ({ reason: r.reason, count: r._count.reason })),
  });
  } catch {
    return NextResponse.json({ error: "Failed to load stats" }, { status: 500 });
  }
}
