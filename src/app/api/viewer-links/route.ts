import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const links = await prisma.sharedLink.findMany({
      where: { userId },
      select: {
        id: true,
        code: true,
        label: true,
        status: true,
        expiresAt: true,
        viewCount: true,
        lastViewedAt: true,
        createdAt: true,
        linkedAccount: { select: { email: true, displayName: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ links });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load links" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { linkedAccountId, password, label, expiryHours } = body;

  if (!linkedAccountId || !password || password.length < 4) {
    return NextResponse.json({ error: "Account and password (min 4 chars) required" }, { status: 400 });
  }

  // Verify user owns this account
  const account = await prisma.linkedAccount.findFirst({
    where: { id: linkedAccountId, userId },
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const code = randomBytes(12).toString("hex");
  const passwordHash = await hashPassword(password);
  const expiresAt = expiryHours ? new Date(Date.now() + expiryHours * 60 * 60 * 1000) : null;

  try {
    const link = await prisma.sharedLink.create({
      data: {
        code,
        userId,
        linkedAccountId,
        passwordHash,
        label: label || null,
        expiresAt,
      },
    });

    return NextResponse.json({ link, code }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to create link" }, { status: 500 });
  }
}
