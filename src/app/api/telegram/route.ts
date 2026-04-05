import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { encrypt, decrypt } from "@/lib/encryption";
import { t } from "@/i18n";

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

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

// PUT: send test message
export async function PUT() {
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
    select: { telegramBotToken: true, telegramChatId: true, email: true, name: true },
  });

  if (!user?.telegramBotToken || !user?.telegramChatId) {
    return NextResponse.json({ error: "Telegram not configured" }, { status: 400 });
  }

  try {
    const botToken = decrypt(user.telegramBotToken);

    // Get connected accounts info
    const accounts = await prisma.linkedAccount.findMany({
      where: { userId },
      select: { email: true, status: true },
    });

    const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;
    const accountList = accounts.map((a) => `  ${a.status === "ACTIVE" ? "✅" : "⚠️"} ${esc(a.email)}`).join("\n");

    const msg = [
      `✅ <b>Telegram Bot Active — ${esc(t("appName"))}</b>`,
      ``,
      `If you are seeing this message, your Telegram bot on <b>${esc(t("appName"))}</b> is active and working correctly.`,
      ``,
      `👤 <b>Account:</b> ${esc(user.name || user.email)}`,
      `📧 <b>Connected Accounts:</b> ${accounts.length} (${activeCount} active)`,
      accountList ? `\n${accountList}` : "",
      ``,
      `🔗 <b>Quick Links:</b>`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard">Dashboard</a> — Overview & stats`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard/accounts">Inbox</a> — Read emails`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard/token-vault">Token Vault</a> — Manage tokens`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard/rules-stealth">Rules & Stealth</a> — Automation rules`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard/keyword-listener">Keyword Listener</a> — Monitor keywords`,
      `• <a href="https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}/dashboard/settings">Settings</a> — Bot & profile settings`,
      ``,
      `📡 You will receive notifications here when:`,
      `• New emails arrive on monitored accounts`,
      `• Keyword rules are triggered`,
      `• Security alerts are detected`,
      ``,
      `🕐 Sent at ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`,
    ].join("\n");

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: user.telegramChatId,
        text: msg,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await res.json();

    if (!data.ok) {
      return NextResponse.json({
        error: data.description || "Telegram rejected the message",
      }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Failed to send test message",
    }, { status: 500 });
  }
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
