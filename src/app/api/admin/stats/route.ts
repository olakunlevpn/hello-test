import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [
    totalUsers,
    totalLinkedAccounts,
    activeAccounts,
    needsReauthAccounts,
    activeSubscriptions,
    expiredSubscriptions,
    revenueAggregate,
    pendingPayments,
    confirmedPayments,
    activeWebhooks,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.linkedAccount.count(),
    prisma.linkedAccount.count({ where: { status: "ACTIVE" } }),
    prisma.linkedAccount.count({ where: { status: "NEEDS_REAUTH" } }),
    prisma.subscription.count({ where: { status: "ACTIVE" } }),
    prisma.subscription.count({ where: { status: "EXPIRED" } }),
    prisma.payment.aggregate({
      where: { status: "CONFIRMED" },
      _sum: { amountUSD: true },
    }),
    prisma.payment.count({ where: { status: "PENDING" } }),
    prisma.payment.count({ where: { status: "CONFIRMED" } }),
    prisma.linkedAccount.count({
      where: { status: "ACTIVE", webhookSubscriptionId: { not: null } },
    }),
    prisma.user.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { linkedAccounts: true } },
        subscription: true,
      },
    }),
  ]);

  return NextResponse.json({
    totalUsers,
    totalLinkedAccounts,
    activeAccounts,
    needsReauthAccounts,
    activeSubscriptions,
    expiredSubscriptions,
    totalRevenue: revenueAggregate._sum.amountUSD ?? 0,
    pendingPayments,
    confirmedPayments,
    activeWebhooks,
    recentUsers,
  });
}
