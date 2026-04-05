import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await prisma.linkedAccount.findMany({
    where: { userId },
    select: { id: true, status: true },
  });

  const accountIds = accounts.map((a) => a.id);

  // Account status breakdown
  const accountStatus = {
    active: accounts.filter((a) => a.status === "ACTIVE").length,
    needsReauth: accounts.filter((a) => a.status === "NEEDS_REAUTH").length,
    revoked: accounts.filter((a) => a.status === "REVOKED").length,
  };

  // Activity over last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const activityLogs = await prisma.activityLog.findMany({
    where: { linkedAccountId: { in: accountIds }, createdAt: { gte: thirtyDaysAgo } },
    select: { action: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  // Group activity by day
  const activityByDay: Record<string, number> = {};
  for (let i = 0; i < 30; i++) {
    const date = new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000);
    activityByDay[date.toISOString().split("T")[0]] = 0;
  }
  for (const log of activityLogs) {
    const day = log.createdAt.toISOString().split("T")[0];
    if (activityByDay[day] !== undefined) activityByDay[day]++;
  }

  const activityTimeline = Object.entries(activityByDay).map(([date, count]) => ({
    date,
    actions: count,
  }));

  // Action types breakdown
  const actionCounts: Record<string, number> = {};
  for (const log of activityLogs) {
    actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
  }
  const topActions = Object.entries(actionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([action, count]) => ({ action, count }));

  // Rule triggers
  const rules = await prisma.automationRule.findMany({
    where: { linkedAccountId: { in: accountIds } },
    select: { name: true, triggerCount: true, isActive: true },
    orderBy: { triggerCount: "desc" },
    take: 10,
  });

  const ruleTriggered = rules
    .filter((r) => r.triggerCount > 0)
    .map((r) => ({ name: r.name, triggers: r.triggerCount }));

  // Invitation performance
  const invitations = await prisma.invitation.findMany({
    where: { userId },
    select: { name: true, views: true, authentications: true },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const invitationPerformance = invitations
    .filter((i) => i.views > 0 || i.authentications > 0)
    .map((i) => ({ name: i.name.substring(0, 20), views: i.views, auths: i.authentications }));

  return NextResponse.json({
    accountStatus,
    activityTimeline,
    topActions,
    ruleTriggered,
    invitationPerformance,
  });
}
