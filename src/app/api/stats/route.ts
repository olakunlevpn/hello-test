import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [
    totalAccounts,
    activeAccounts,
    needsReauthAccounts,
    revokedAccounts,
    activeWebhooks,
    subscription,
    recentPayments,
  ] = await Promise.all([
    prisma.linkedAccount.count({ where: { userId } }),
    prisma.linkedAccount.count({ where: { userId, status: "ACTIVE" } }),
    prisma.linkedAccount.count({ where: { userId, status: "NEEDS_REAUTH" } }),
    prisma.linkedAccount.count({ where: { userId, status: "REVOKED" } }),
    prisma.linkedAccount.count({
      where: { userId, status: "ACTIVE", webhookSubscriptionId: { not: null } },
    }),
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.payment.findMany({
      where: { userId, status: "CONFIRMED" },
      orderBy: { confirmedAt: "desc" },
      take: 5,
    }),
  ]);

  const accounts = await prisma.linkedAccount.findMany({
    where: { userId },
    select: {
      id: true,
      email: true,
      displayName: true,
      status: true,
      lastRefreshedAt: true,
      tokenExpiresAt: true,
      webhookSubscriptionId: true,
      webhookExpiresAt: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  const healthyTokens = accounts.filter(
    (a) =>
      a.status === "ACTIVE" &&
      new Date(a.tokenExpiresAt).getTime() > Date.now() + 10 * 60 * 1000
  ).length;

  return NextResponse.json({
    totalAccounts,
    activeAccounts,
    needsReauthAccounts,
    revokedAccounts,
    activeWebhooks,
    healthyTokens,
    subscriptionStatus: subscription?.status || null,
    subscriptionExpires: subscription?.currentPeriodEnd || null,
    accounts,
    recentPayments,
  });
}
