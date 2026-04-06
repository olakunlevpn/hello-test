import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { deviceCode, authToken } = await request.json();

  if (!deviceCode || !authToken) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Validate auth token still valid
  const token = await prisma.authorizationToken.findFirst({
    where: { token: authToken, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!token) {
    return NextResponse.json({ status: "error", error: "Authorization token expired" });
  }

  // Poll Microsoft token endpoint
  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        grant_type: "urn:ietf:params:oauth:grant-type:device_code",
        device_code: deviceCode,
      }),
    }
  );

  const data = await response.json();

  // Still waiting for user to authenticate
  if (data.error === "authorization_pending") {
    return NextResponse.json({ status: "pending" });
  }

  // User declined or code expired
  if (data.error) {
    return NextResponse.json({ status: "error", error: data.error_description || data.error });
  }

  // Success! We got tokens
  const { access_token, refresh_token, expires_in } = data;

  try {
    // Get Microsoft user profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ status: "error", error: "Failed to get profile" });
    }

    const profile = await profileResponse.json();

    // Encrypt tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Link account to the admin who generated the auth token
    const userId = token.createdById;

    await prisma.linkedAccount.upsert({
      where: {
        userId_microsoftUserId: {
          userId,
          microsoftUserId: profile.id,
        },
      },
      update: {
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        status: "ACTIVE",
        lastRefreshedAt: new Date(),
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
      },
      create: {
        userId,
        microsoftUserId: profile.id,
        email: profile.mail || profile.userPrincipalName,
        displayName: profile.displayName,
        accessToken: encryptedAccessToken,
        refreshToken: encryptedRefreshToken,
        tokenExpiresAt,
        status: "ACTIVE",
        lastRefreshedAt: new Date(),
      },
    });

    // Mark auth token as used
    await prisma.authorizationToken.update({
      where: { id: token.id },
      data: { usedAt: new Date() },
    });

    // Try to create webhook subscription
    try {
      const { MicrosoftGraphService } = await import("@/lib/microsoft-graph");
      const linkedAccount = await prisma.linkedAccount.findFirst({
        where: { userId, microsoftUserId: profile.id },
      });
      if (linkedAccount) {
        const graphService = new MicrosoftGraphService(linkedAccount);
        const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/microsoft`;
        const subscription = await graphService.createSubscription(webhookUrl);
        await prisma.linkedAccount.update({
          where: { id: linkedAccount.id },
          data: {
            webhookSubscriptionId: subscription.id,
            webhookExpiresAt: new Date(subscription.expirationDateTime),
          },
        });
      }
    } catch {
      // Webhook creation not critical
    }

    return NextResponse.json({
      status: "complete",
      email: profile.mail || profile.userPrincipalName,
      displayName: profile.displayName,
    });
  } catch {
    return NextResponse.json({
      status: "error",
      error: "Failed to link account",
    });
  }
}
