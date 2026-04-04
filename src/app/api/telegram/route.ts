import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";

// GET: return current telegram settings (masked token + chat ID)
export async function GET() {
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramBotToken: true, telegramChatId: true },
  });

  return NextResponse.json({
    hasBotToken: !!user?.telegramBotToken,
    chatId: user?.telegramChatId || null,
  });
}

// PATCH: save bot token or remove it
export async function PATCH(request: NextRequest) {
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
  const { botToken, action } = body;

  // Remove bot token and chat ID
  if (action === "remove") {
    await prisma.user.update({
      where: { id: userId },
      data: { telegramBotToken: null, telegramChatId: null },
    });
    return NextResponse.json({ success: true });
  }

  // Save bot token (encrypted)
  if (botToken) {
    // Validate the token by calling Telegram getMe
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/getMe`);
      if (!res.ok) {
        return NextResponse.json(
          { error: "Invalid bot token. Please check and try again." },
          { status: 400 }
        );
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to validate bot token." },
        { status: 400 }
      );
    }

    const encryptedToken = encrypt(botToken);
    await prisma.user.update({
      where: { id: userId },
      data: { telegramBotToken: encryptedToken },
    });

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: "No action specified" }, { status: 400 });
}

// POST: fetch chat ID from latest message sent to the bot
export async function POST() {
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramBotToken: true },
  });

  if (!user?.telegramBotToken) {
    return NextResponse.json(
      { error: "No bot token configured" },
      { status: 400 }
    );
  }

  try {
    const botToken = decrypt(user.telegramBotToken);

    // Get the latest updates (messages sent to the bot)
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=1&offset=-1`
    );

    if (!res.ok) {
      return NextResponse.json(
        { error: "Failed to fetch updates from Telegram" },
        { status: 500 }
      );
    }

    const data = await res.json();
    const updates = data.result || [];

    if (updates.length === 0) {
      return NextResponse.json(
        { error: "No messages found. Send a message to your bot first." },
        { status: 404 }
      );
    }

    // Extract chat ID from the latest message
    const chatId =
      updates[0]?.message?.chat?.id?.toString() ||
      updates[0]?.my_chat_member?.chat?.id?.toString();

    if (!chatId) {
      return NextResponse.json(
        { error: "Could not extract chat ID. Send a text message to your bot and try again." },
        { status: 404 }
      );
    }

    // Save the chat ID
    await prisma.user.update({
      where: { id: userId },
      data: { telegramChatId: chatId },
    });

    return NextResponse.json({ chatId });
  } catch {
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    );
  }
}
