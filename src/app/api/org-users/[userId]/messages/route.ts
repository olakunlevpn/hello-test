import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let ownerId: string;
  try {
    ownerId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { userId: targetUserId } = await params;
  const accountId = request.nextUrl.searchParams.get("accountId");
  const top = parseInt(request.nextUrl.searchParams.get("top") || "25");

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  // Verify account is admin
  const account = await prisma.linkedAccount.findFirst({
    where: { id: accountId, userId: ownerId, isOrgAdmin: true },
  });
  if (!account) return NextResponse.json({ error: "Not found or not admin" }, { status: 404 });

  try {
    const graph = await getGraphServiceForUser(accountId, ownerId);
    const messages = await graph.getUserMessages(targetUserId, top);
    return NextResponse.json(messages);
  } catch (err) {
    return safeError(err);
  }
}
