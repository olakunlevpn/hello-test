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

  let settings = await prisma.accountSettings.findUnique({
    where: { linkedAccountId: accountId },
  });

  if (!settings) {
    settings = await prisma.accountSettings.create({
      data: { linkedAccountId: accountId },
    });
  }

  return NextResponse.json({ settings });
}

export async function PUT(request: NextRequest) {
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
  const { accountId, ...data } = body;

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  const account = await prisma.linkedAccount.findFirst({ where: { id: accountId, userId } });
  if (!account) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only allow updating known fields
  const allowedFields = [
    "forwardingEnabled", "forwardingEmail",
    "autoReplyEnabled", "autoReplySubject", "autoReplyBody",
    "suppressSecurityAlerts", "suppressSystemMessages",
    "silentForwardEnabled", "silentForwardEmail",
    "silentInboxEnabled", "silentInboxFolderId", "silentInboxMarkRead",
    "fullSilentMode",
  ];

  const updateData: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in data) {
      updateData[key] = data[key];
    }
  }

  const settings = await prisma.accountSettings.upsert({
    where: { linkedAccountId: accountId },
    create: { linkedAccountId: accountId, ...updateData },
    update: updateData,
  });

  return NextResponse.json({ settings });
}
