import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cloudflareApiToken: true, cloudflareAccountId: true },
  });

  return NextResponse.json({
    hasApiToken: !!user?.cloudflareApiToken,
    accountId: user?.cloudflareAccountId || null,
  });
}

export async function PATCH(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  if (body.action === "remove") {
    await prisma.user.update({
      where: { id: userId },
      data: { cloudflareApiToken: null, cloudflareAccountId: null },
    });
    return NextResponse.json({ success: true });
  }

  const { apiToken, accountId } = body;

  if (!apiToken || !accountId) {
    return NextResponse.json({ error: "API token and account ID are required" }, { status: 400 });
  }

  // Verify the token works by calling Cloudflare API
  const verifyRes = await fetch("https://api.cloudflare.com/client/v4/user/tokens/verify", {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!verifyRes.ok) {
    return NextResponse.json({ error: "Invalid Cloudflare API token" }, { status: 400 });
  }

  const verifyData = await verifyRes.json();
  if (!verifyData.success) {
    return NextResponse.json({ error: "Cloudflare API token verification failed" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: {
      cloudflareApiToken: encrypt(apiToken),
      cloudflareAccountId: accountId,
    },
  });

  return NextResponse.json({ success: true });
}
