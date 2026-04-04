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
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rules = await prisma.automationRule.findMany({
    where: { linkedAccountId: accountId },
    orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ rules });
}

export async function POST(request: NextRequest) {
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

  const body = await request.json();
  const { accountId, name, conditions, conditionLogic, actions, stopProcessing, priority } = body;

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }
  if (!name?.trim()) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (!Array.isArray(conditions) || conditions.length === 0) {
    return NextResponse.json({ error: "At least one condition is required" }, { status: 400 });
  }
  if (!Array.isArray(actions) || actions.length === 0) {
    return NextResponse.json({ error: "At least one action is required" }, { status: 400 });
  }

  const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const rule = await prisma.automationRule.create({
    data: {
      linkedAccountId: accountId,
      name: name.trim(),
      conditions: conditions ?? [],
      conditionLogic: conditionLogic ?? "AND",
      actions: actions ?? [],
      stopProcessing: stopProcessing ?? false,
      priority: priority ?? 0,
    },
  });

  return NextResponse.json({ rule });
}
