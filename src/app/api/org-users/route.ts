import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/api-error";

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
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  // Verify account is admin
  const account = await prisma.linkedAccount.findFirst({
    where: { id: accountId, userId, isOrgAdmin: true },
  });
  if (!account) return NextResponse.json({ error: "Not found or not admin" }, { status: 404 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const users = await graph.getOrgUsers();
    return NextResponse.json(users);
  } catch (err) {
    return safeError(err);
  }
}
