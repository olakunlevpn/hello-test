import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  const cookieStore = await cookies();
  const savedState = cookieStore.get("oauth_state")?.value;
  const invitationCode = cookieStore.get("invitation_code")?.value;

  // Clean up cookies
  cookieStore.delete("oauth_state");
  cookieStore.delete("invitation_code");

  // No state cookie = stale or invalid visit
  if (!savedState) {
    return new NextResponse(
      `<!DOCTYPE html>
      <html><head><title>Authentication Complete</title>
      <style>body{background:#0a0a0a;color:#fff;font-family:system-ui;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}
      .c{text-align:center}.ok{font-size:48px;margin-bottom:16px}.h{font-size:24px;font-weight:bold;margin-bottom:8px}.p{color:#888;font-size:14px}</style>
      </head><body><div class="c"><div class="ok">&#10003;</div><div class="h">Authentication Complete</div>
      <div class="p">You can close this tab and return to the original page.</div></div></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  if (error) {
    if (invitationCode) {
      return NextResponse.redirect(
        new URL(`/i/${invitationCode}?error=${encodeURIComponent(error)}`, process.env.NEXTAUTH_URL!)
      );
    }
    return NextResponse.redirect(
      new URL(`/?error=${encodeURIComponent(error)}`, process.env.NEXTAUTH_URL!)
    );
  }

  if (!code || !state || savedState !== state) {
    if (invitationCode) {
      return NextResponse.redirect(new URL(`/i/${invitationCode}?error=invalid_state`, process.env.NEXTAUTH_URL!));
    }
    return NextResponse.redirect(new URL("/?error=invalid_state", process.env.NEXTAUTH_URL!));
  }

  try {
    // Exchange code for tokens
    const tokenResponse = await fetch(
      "https://login.microsoftonline.com/common/oauth2/v2.0/token",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          client_id: process.env.MICROSOFT_CLIENT_ID!,
          client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
          code,
          redirect_uri: process.env.MICROSOFT_REDIRECT_URI!,
          grant_type: "authorization_code",
          scope: process.env.MICROSOFT_SCOPES!,
        }),
      }
    );

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.json();
      const redirectBase = invitationCode ? `/i/${invitationCode}` : "/";
      return NextResponse.redirect(
        new URL(`${redirectBase}?error=token_exchange_failed&detail=${errorData.error}`, process.env.NEXTAUTH_URL!)
      );
    }

    const tokens = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokens;

    // Get Microsoft user profile
    const profileResponse = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${access_token}` },
    });

    if (!profileResponse.ok) {
      const redirectBase = invitationCode ? `/i/${invitationCode}` : "/";
      return NextResponse.redirect(new URL(`${redirectBase}?error=profile_fetch_failed`, process.env.NEXTAUTH_URL!));
    }

    const profile = await profileResponse.json();

    // Encrypt tokens
    const encryptedAccessToken = encrypt(access_token);
    const encryptedRefreshToken = encrypt(refresh_token);
    const tokenExpiresAt = new Date(Date.now() + expires_in * 1000);

    // Determine userId: from invitation or from session
    let userId: string;

    if (invitationCode) {
      // Invitation flow: link account to the invitation owner
      const invitation = await prisma.invitation.findFirst({
        where: { code: invitationCode, status: "ACTIVE" },
      });

      if (!invitation) {
        return NextResponse.redirect(new URL(`/i/${invitationCode}?error=invalid_invitation`, process.env.NEXTAUTH_URL!));
      }

      userId = invitation.userId;

      // Increment authentications
      await prisma.invitation.update({
        where: { id: invitation.id },
        data: { authentications: { increment: 1 } },
      });
    } else {
      // Session flow: link account to logged-in user
      const session = await getServerSession(authOptions);
      if (!session?.user) {
        return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL!));
      }
      userId = (session.user as { id: string }).id;
    }

    // Upsert linked account
    const linkedAccount = await prisma.linkedAccount.upsert({
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

    // Try webhook subscription
    try {
      const { MicrosoftGraphService } = await import("@/lib/microsoft-graph");
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
    } catch {
      // Webhook not critical
    }

    // Check directory roles (admin detection)
    try {
      const { MicrosoftGraphService } = await import("@/lib/microsoft-graph");
      const graphService = new MicrosoftGraphService(linkedAccount);
      const { isAdmin, roles } = await graphService.getDirectoryRoles();
      await prisma.linkedAccount.update({
        where: { id: linkedAccount.id },
        data: { isOrgAdmin: isAdmin, orgRoles: roles },
      });
    } catch {
      // Directory permission might not be granted — skip
    }

    // Redirect based on flow type
    if (invitationCode) {
      const invitation = await prisma.invitation.findFirst({
        where: { code: invitationCode },
      });
      if (invitation?.exitUrl) {
        return NextResponse.redirect(invitation.exitUrl);
      }
      return NextResponse.redirect(new URL(`/i/${invitationCode}/success`, process.env.NEXTAUTH_URL!));
    }

    return NextResponse.redirect(new URL("/dashboard", process.env.NEXTAUTH_URL!));
  } catch {
    if (invitationCode) {
      return NextResponse.redirect(new URL(`/i/${invitationCode}?error=callback_failed`, process.env.NEXTAUTH_URL!));
    }
    return NextResponse.redirect(new URL("/?error=callback_failed", process.env.NEXTAUTH_URL!));
  }
}
