import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  const account = await prisma.linkedAccount.findFirst({
    where: { id, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.linkedAccount.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;

  try {
    const graph = await getGraphServiceForUser(id, userId);
    const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/microsoft`;
    const subscription = await graph.createSubscription(webhookUrl);

    await prisma.linkedAccount.update({
      where: { id },
      data: {
        webhookSubscriptionId: subscription.id,
        webhookExpiresAt: new Date(subscription.expirationDateTime),
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err);
  }
}
