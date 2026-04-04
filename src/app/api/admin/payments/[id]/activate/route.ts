import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (payment.status === "CONFIRMED") {
    return NextResponse.json({ error: "Payment already confirmed" }, { status: 400 });
  }

  await prisma.payment.update({
    where: { id },
    data: { status: "CONFIRMED", confirmedAt: new Date() },
  });

  const periodDays = payment.planInterval === "YEARLY" ? 365 : 30;

  const existing = await prisma.subscription.findUnique({
    where: { userId: payment.userId },
  });

  const now = new Date();
  let periodStart: Date;
  let periodEnd: Date;

  if (existing && existing.status === "ACTIVE" && existing.currentPeriodEnd > now) {
    periodStart = existing.currentPeriodStart;
    periodEnd = new Date(existing.currentPeriodEnd);
    periodEnd.setDate(periodEnd.getDate() + periodDays);
  } else {
    periodStart = now;
    periodEnd = new Date();
    periodEnd.setDate(periodEnd.getDate() + periodDays);
  }

  const subscription = await prisma.subscription.upsert({
    where: { userId: payment.userId },
    update: {
      plan: payment.planInterval,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
    create: {
      userId: payment.userId,
      plan: payment.planInterval,
      status: "ACTIVE",
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
    },
  });

  return NextResponse.json({ success: true, subscription });
}
