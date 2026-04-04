import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { encrypt } from "@/lib/encryption";

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
  const { access_token, refresh_token, user_email, display_name, microsoft_user_id, token_expires_at } = body;

  if (!access_token || !refresh_token) {
    return NextResponse.json({ error: "access_token and refresh_token are required" }, { status: 400 });
  }
  if (!user_email?.trim()) {
    return NextResponse.json({ error: "user_email is required" }, { status: 400 });
  }

  const email = user_email.trim();
  const name = (display_name || email).trim();
  const msUserId = microsoft_user_id || email;

  const encryptedAccessToken = encrypt(access_token);
  const encryptedRefreshToken = encrypt(refresh_token);
  const tokenExpiresAt = token_expires_at ? new Date(token_expires_at) : new Date(Date.now() + 3600 * 1000);

  const account = await prisma.linkedAccount.upsert({
    where: {
      userId_microsoftUserId: { userId, microsoftUserId: msUserId },
    },
    create: {
      userId,
      microsoftUserId: msUserId,
      email,
      displayName: name,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      status: "ACTIVE",
    },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      email,
      displayName: name,
      status: "ACTIVE",
      lastRefreshedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, accountId: account.id });
}
