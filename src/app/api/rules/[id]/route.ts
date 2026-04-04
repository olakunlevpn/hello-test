import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

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

  const rule = await prisma.automationRule.findUnique({
    where: { id },
    include: { linkedAccount: { select: { userId: true } } },
  });

  if (!rule || rule.linkedAccount.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.automationRule.delete({ where: { id } });

  return NextResponse.json({ success: true });
}

export async function PATCH(
  request: NextRequest,
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
  const body = await request.json();

  const rule = await prisma.automationRule.findUnique({
    where: { id },
    include: { linkedAccount: { select: { userId: true } } },
  });

  if (!rule || rule.linkedAccount.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await prisma.automationRule.update({
    where: { id },
    data: {
      name: body.name ?? rule.name,
      conditions: body.conditions ?? rule.conditions,
      conditionLogic: body.conditionLogic ?? rule.conditionLogic,
      actions: body.actions ?? rule.actions,
      stopProcessing: body.stopProcessing ?? rule.stopProcessing,
      priority: body.priority ?? rule.priority,
      isActive: body.isActive ?? rule.isActive,
    },
  });

  return NextResponse.json({ rule: updated });
}
