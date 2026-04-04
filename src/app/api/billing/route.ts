import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";

export async function GET() {
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const payments = await prisma.payment.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Check for expired subscription
  if (
    subscription &&
    subscription.status === "ACTIVE" &&
    new Date(subscription.currentPeriodEnd) < new Date()
  ) {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { status: "EXPIRED" },
    });
    subscription.status = "EXPIRED";
  }

  return NextResponse.json({
    subscription,
    payments,
    prices: {
      monthly: Number(process.env.PLAN_PRICE_MONTHLY_USD) || 29,
      yearly: Number(process.env.PLAN_PRICE_YEARLY_USD) || 290,
    },
  });
}
