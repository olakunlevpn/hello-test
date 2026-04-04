import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { safeError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  let ownerId: string;
  try {
    ownerId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { accountId, displayName, mailNickname, userPrincipalName, password } = await request.json();
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  if (!displayName || !userPrincipalName || !password) return NextResponse.json({ error: "displayName, userPrincipalName, and password are required" }, { status: 400 });

  const account = await prisma.linkedAccount.findFirst({
    where: { id: accountId, userId: ownerId, isOrgAdmin: true },
  });
  if (!account) return NextResponse.json({ error: "Not found or not admin" }, { status: 404 });

  try {
    const graph = await getGraphServiceForUser(accountId, ownerId);
    const user = await graph.createOrgUser({
      displayName,
      mailNickname: mailNickname || displayName.replace(/\s+/g, "").toLowerCase(),
      userPrincipalName,
      password,
    });
    return NextResponse.json({ user });
  } catch (err) {
    return safeError(err);
  }
}
