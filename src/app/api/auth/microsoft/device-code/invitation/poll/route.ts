import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  const { deviceCode, invitationId } = await request.json();

  if (!deviceCode || !invitationId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "ACTIVE" },
  });

  if (!invitation) {
    return NextResponse.json({ status: "error", error: "Invalid invitation" });
  }

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

  if (data.error === "authorization_pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (data.error) {
    return NextResponse.json({ status: "error", error: data.error_description || data.error });
  }

  const { access_token, refresh_token, expires_in } = data;

  try {
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileResponse.ok) {
      return NextResponse.json({ status: "error", error: "Failed to get profile" });
    }

    const profile = await profileResponse.json();

    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    const userId = invitation.userId;

    await prisma.linkedAccount.upsert({
      where: {
        userId_microsoftUserId: { userId, microsoftUserId: profile.id },
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

    // Increment authentications
    await prisma.invitation.update({
      where: { id: invitation.id },
      data: { authentications: { increment: 1 } },
    });

    // Try webhook subscription
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
      // non-critical
    }

    return NextResponse.json({
      status: "complete",
      email: profile.mail || profile.userPrincipalName,
      exitUrl: invitation.exitUrl || null,
    });
  } catch {
    return NextResponse.json({
      status: "error",
      error: "Failed to link account",
    });
  }
}
