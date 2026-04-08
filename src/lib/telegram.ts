import { prisma } from "./prisma";
import { decrypt } from "./encryption";

export async function sendTelegramNotification(
  userId: string,
  message: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramBotToken: true, telegramChatId: true },
  });

  if (!user?.telegramBotToken || !user?.telegramChatId) return false;

  try {
    const botToken = decrypt(user.telegramBotToken);
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: user.telegramChatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramDocument(
  userId: string,
  fileContent: string,
  fileName: string,
  caption: string
): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { telegramBotToken: true, telegramChatId: true },
  });

  if (!user?.telegramBotToken || !user?.telegramChatId) return false;

  try {
    const botToken = decrypt(user.telegramBotToken);
    const formData = new FormData();
    formData.append("chat_id", user.telegramChatId);
    formData.append("caption", caption);
    formData.append("document", new Blob([fileContent], { type: "text/plain" }), fileName);

    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendDocument`,
      { method: "POST", body: formData }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function sendTelegramMessage(
  botToken: string,
  chatId: string,
  message: string
): Promise<boolean> {
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/sendMessage`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: "HTML",
        }),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}
