import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function GET(request: NextRequest) {
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

  const accountId = request.nextUrl.searchParams.get("accountId");
  const limit = parseInt(request.nextUrl.searchParams.get("limit") || "100");

  const where: Record<string, unknown> = {};

  if (accountId) {
    const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
    if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });
    where.linkedAccountId = accountId;
  } else {
    const accounts = await prisma.linkedAccount.findMany({ where: { userId }, select: { id: true } });
    where.linkedAccountId = { in: accounts.map((a) => a.id) };
  }

  const logs = await prisma.activityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      linkedAccount: { select: { email: true, displayName: true } },
    },
  });

  return NextResponse.json({ logs });
}
