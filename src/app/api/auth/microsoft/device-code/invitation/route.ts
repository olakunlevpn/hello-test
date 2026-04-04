import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const { invitationId } = await request.json();

  if (!invitationId) {
    return NextResponse.json({ error: "Invitation ID required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "ACTIVE" },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 400 });
  }

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
    const errorBody = await response.text();
    return NextResponse.json(
      { error: `Device code request failed: ${errorBody}` },
      { status: 500 }
    );
  }

  const data = await response.json();

  return NextResponse.json({
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
  });
}
