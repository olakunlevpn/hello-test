import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // User signups over last 30 days
  const users = await prisma.user.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  const signupsByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    signupsByDay[date.toISOString().split("T")[0]] = 0;
  }
  for (const u of users) {
    const day = u.createdAt.toISOString().split("T")[0];
    if (signupsByDay[day] !== undefined) signupsByDay[day]++;
  }
  const userGrowth = Object.entries(signupsByDay).map(([date, count]) => ({ date, signups: count }));

  // Revenue over last 30 days
  const payments = await prisma.payment.findMany({
    where: { status: "CONFIRMED", confirmedAt: { gte: thirtyDaysAgo } },
    select: { amountUSD: true, confirmedAt: true },
    orderBy: { confirmedAt: "asc" },
  });

  const revenueByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    revenueByDay[date.toISOString().split("T")[0]] = 0;
  }
  for (const p of payments) {
    if (p.confirmedAt) {
      const day = p.confirmedAt.toISOString().split("T")[0];
      if (revenueByDay[day] !== undefined) revenueByDay[day] += p.amountUSD;
    }
  }
  const revenueTimeline = Object.entries(revenueByDay).map(([date, amount]) => ({ date, revenue: Math.round(amount * 100) / 100 }));

  // Account status breakdown (all users)
  const allAccounts = await prisma.linkedAccount.findMany({
    select: { status: true },
  });
  const accountStatus = {
    active: allAccounts.filter((a) => a.status === "ACTIVE").length,
    needsReauth: allAccounts.filter((a) => a.status === "NEEDS_REAUTH").length,
    revoked: allAccounts.filter((a) => a.status === "REVOKED").length,
  };

  // Subscription breakdown
  const subscriptions = await prisma.subscription.findMany({
    select: { status: true, plan: true },
  });
  const subscriptionStatus = {
    active: subscriptions.filter((s) => s.status === "ACTIVE").length,
    expired: subscriptions.filter((s) => s.status === "EXPIRED").length,
    cancelled: subscriptions.filter((s) => s.status === "CANCELLED").length,
  };
  const subscriptionPlans = {
    monthly: subscriptions.filter((s) => s.plan === "MONTHLY" && s.status === "ACTIVE").length,
    yearly: subscriptions.filter((s) => s.plan === "YEARLY" && s.status === "ACTIVE").length,
  };

  // Webhook logs — processed vs failed last 30 days
  const webhookLogs = await prisma.webhookLog.findMany({
    where: { createdAt: { gte: thirtyDaysAgo } },
    select: { status: true, createdAt: true },
  });

  const webhookByDay: Record<string, { processed: number; failed: number }> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    webhookByDay[date.toISOString().split("T")[0]] = { processed: 0, failed: 0 };
  }
  for (const log of webhookLogs) {
    const day = log.createdAt.toISOString().split("T")[0];
    if (webhookByDay[day]) {
      if (log.status === "processed") webhookByDay[day].processed++;
      else webhookByDay[day].failed++;
    }
  }
  const webhookTimeline = Object.entries(webhookByDay).map(([date, data]) => ({ date, ...data }));

  // Top users by connected accounts
  const topUsers = await prisma.user.findMany({
    select: {
      email: true,
      name: true,
      _count: { select: { linkedAccounts: true } },
    },
    orderBy: { linkedAccounts: { _count: "desc" } },
    take: 10,
  });
  const topUsersByAccounts = topUsers
    .filter((u) => u._count.linkedAccounts > 0)
    .map((u) => ({ name: u.name || u.email.split("@")[0], accounts: u._count.linkedAccounts }));

  // Bot detection stats — last 30 days
  let botBlocksByDay: { date: string; blocked: number }[] = [];
  let botBlocksTotal = 0;
  let botBlocksToday = 0;
  let botTopCountries: { country: string; count: number }[] = [];
  let botReasonBreakdown: { reason: string; count: number }[] = [];

  try {
    const todayStart = new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const botLogs = await prisma.botLog.findMany({
      where: { action: "blocked", createdAt: { gte: thirtyDaysAgo } },
      select: { createdAt: true, country: true, reason: true },
    });

    botBlocksTotal = botLogs.length;
    botBlocksToday = botLogs.filter((b) => b.createdAt >= todayStart).length;

    // Blocks per day
    const botByDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
      botByDay[date.toISOString().split("T")[0]] = 0;
    }
    for (const b of botLogs) {
      const day = b.createdAt.toISOString().split("T")[0];
      if (botByDay[day] !== undefined) botByDay[day]++;
    }
    botBlocksByDay = Object.entries(botByDay).map(([date, count]) => ({ date, blocked: count }));

    // Top countries
    const countryMap: Record<string, number> = {};
    for (const b of botLogs) {
      if (b.country) countryMap[b.country] = (countryMap[b.country] || 0) + 1;
    }
    botTopCountries = Object.entries(countryMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([country, count]) => ({ country, count }));

    // Reason breakdown
    const reasonMap: Record<string, number> = {};
    for (const b of botLogs) {
      const short = b.reason.split(":")[0];
      reasonMap[short] = (reasonMap[short] || 0) + 1;
    }
    botReasonBreakdown = Object.entries(reasonMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([reason, count]) => ({ reason, count }));
  } catch { /* bot tables may not exist yet */ }

  return NextResponse.json({
    userGrowth,
    revenueTimeline,
    accountStatus,
    subscriptionStatus,
    subscriptionPlans,
    webhookTimeline,
    topUsersByAccounts,
    botBlocksByDay,
    botBlocksTotal,
    botBlocksToday,
    botTopCountries,
    botReasonBreakdown,
  });
}
