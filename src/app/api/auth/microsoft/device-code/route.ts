import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { authToken } = await request.json();

  if (!authToken) {
    return NextResponse.json({ error: "Authorization token required" }, { status: 400 });
  }

  // Validate auth token
  const token = await prisma.authorizationToken.findFirst({
    where: { token: authToken, usedAt: null, expiresAt: { gt: new Date() } },
  });

  if (!token) {
    return NextResponse.json({ error: "Invalid or expired authorization token" }, { status: 400 });
  }

  // Request device code from Microsoft
  const response = await fetch(
    "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode",
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.MICROSOFT_CLIENT_ID!,
        scope: process.env.MICROSOFT_SCOPES!,
      }),
    }
  );

  if (!response.ok) {
    return NextResponse.json({ error: "Failed to get device code" }, { status: 500 });
  }

  const data = await response.json();

  return NextResponse.json({
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
    authTokenId: token.id,
  });
}
