import { prisma } from "@/lib/prisma";
import { corsResponse, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function POST(request: Request) {
  const { invitationId } = await request.json();

  if (!invitationId) {
    return corsResponse({ error: "Invitation ID required" }, 400);
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, status: "ACTIVE" },
  });

  if (!invitation) {
    return corsResponse({ error: "Invalid or inactive invitation" }, 400);
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
    return corsResponse(
      { error: `Device code request failed: ${errorBody}` },
      500
    );
  }

  const data = await response.json();

  return corsResponse({
    userCode: data.user_code,
    verificationUri: data.verification_uri,
    deviceCode: data.device_code,
    expiresIn: data.expires_in,
    interval: data.interval || 5,
  });
}
