import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { decrypt } from "@/lib/encryption";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`forgot:${getRateLimitKey(request)}`, 3, 60 * 1000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const { email } = await request.json();

  if (!email) {
    return NextResponse.json({ success: true });
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, telegramBotToken: true, telegramChatId: true },
  });

  // Always return success to avoid leaking whether email exists
  if (!user) {
    return NextResponse.json({ success: true });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.passwordResetToken.create({
    data: {
      userId: user.id,
      token,
      expiresAt,
    },
  });

  // Send Telegram notification if configured
  if (user.telegramBotToken && user.telegramChatId) {
    try {
      const botToken = decrypt(user.telegramBotToken);
      const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
      const message = `Your password reset link:\n${resetUrl}\n\nThis link expires in 1 hour.`;

      await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text: message,
        }),
      });
    } catch {
      // Silently handle — don't expose errors
    }
  }

  return NextResponse.json({ success: true });
}
