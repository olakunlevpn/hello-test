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

  const accounts = await prisma.linkedAccount.findMany({
    where: { userId },
    select: {
      id: true,
      microsoftUserId: true,
      email: true,
      displayName: true,
      status: true,
      lastRefreshedAt: true,
      tokenExpiresAt: true,
      webhookSubscriptionId: true,
      webhookExpiresAt: true,
      isOrgAdmin: true,
      orgRoles: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ accounts });
}
