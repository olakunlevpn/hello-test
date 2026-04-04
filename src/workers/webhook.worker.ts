import "./env";
import { Worker } from "bullmq";
import Redis from "ioredis";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { MicrosoftGraphService } from "../lib/microsoft-graph";
import { decrypt } from "../lib/encryption";
import { processAccountSettings } from "../lib/settings-processor";
import { processRules } from "../lib/rule-engine";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Workers run as separate processes, so they need their own Prisma instance
const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const worker = new Worker(
  "webhook-processing",
  async (job) => {
    const { type } = job.data;

    if (type === "notification") {
      const { resource, subscriptionId } = job.data;

      const account = await prisma.linkedAccount.findFirst({
        where: { webhookSubscriptionId: subscriptionId, status: "ACTIVE" },
      });

      if (!account) return;

      try {
        const graphService = new MicrosoftGraphService(account);
        const messageId = resource.split("/messages/")[1];
        if (messageId) {
          const email = await graphService.getMessage(messageId);

          // Process account settings (forwarding, auto-reply, silent mode)
          const accountSettings = await prisma.accountSettings.findUnique({
            where: { linkedAccountId: account.id },
          });

          let emailDeleted = false;
          if (accountSettings) {
            const settingsResult = await processAccountSettings(
              graphService,
              email,
              accountSettings,
              prisma as any,
              account.id
            );
            emailDeleted = settingsResult.deleted;
          }

          // Process automation rules (skip if email was deleted by settings)
          if (!emailDeleted) {
            const rules = await prisma.automationRule.findMany({
              where: { linkedAccountId: account.id, isActive: true },
              orderBy: [{ priority: "asc" }, { createdAt: "desc" }],
            });

            // Build telegram config for rule actions
            const userForTelegram = await prisma.user.findUnique({
              where: { id: account.userId },
              select: { telegramBotToken: true, telegramChatId: true },
            });

            let telegramConfig: { botToken: string; chatId: string } | null = null;
            if (userForTelegram?.telegramBotToken && userForTelegram?.telegramChatId) {
              telegramConfig = {
                botToken: decrypt(userForTelegram.telegramBotToken),
                chatId: userForTelegram.telegramChatId,
              };
            }

            const ruleResult = await processRules(
              graphService,
              email,
              rules as any,
              telegramConfig,
              prisma as any,
              account.id
            );

            if (ruleResult.emailDeleted) {
              emailDeleted = true;
            }
          }

          // Send general Telegram notification for new email
          if (!emailDeleted) {
            const userTg = await prisma.user.findUnique({
              where: { id: account.userId },
              select: { telegramBotToken: true, telegramChatId: true },
            });

            if (userTg?.telegramBotToken && userTg?.telegramChatId) {
              try {
                const botToken = decrypt(userTg.telegramBotToken);
                const senderName =
                  email.from?.emailAddress?.name ||
                  email.from?.emailAddress?.address ||
                  "Unknown";
                const subject = email.subject || "(no subject)";
                const msg = `📧 <b>New Email</b>\nFrom: ${senderName}\nSubject: ${subject}`;

                await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    chat_id: userTg.telegramChatId,
                    text: msg,
                    parse_mode: "HTML",
                  }),
                });
              } catch {
                // Silently handle Telegram errors
              }
            }
          }
        }

        await prisma.webhookLog.create({
          data: {
            linkedAccountId: account.id,
            payload: job.data,
            processedAt: new Date(),
            status: "processed",
          },
        });
      } catch {
        await prisma.webhookLog.create({
          data: {
            linkedAccountId: account.id,
            payload: job.data,
            status: "failed",
          },
        });
      }

      return;
    }

    if (type === "renew-webhooks") {
      const twentyFourHoursFromNow = new Date(Date.now() + 24 * 60 * 60 * 1000);

      const accounts = await prisma.linkedAccount.findMany({
        where: {
          status: "ACTIVE",
          webhookSubscriptionId: { not: null },
          webhookExpiresAt: { lte: twentyFourHoursFromNow },
        },
      });

      for (const account of accounts) {
        try {
          const graphService = new MicrosoftGraphService(account);
          const renewed = await graphService.renewSubscription(account.webhookSubscriptionId!);

          await prisma.linkedAccount.update({
            where: { id: account.id },
            data: { webhookExpiresAt: new Date(renewed.expirationDateTime) },
          });
        } catch {
          try {
            const graphService = new MicrosoftGraphService(account);
            const webhookUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/microsoft`;
            const newSub = await graphService.createSubscription(webhookUrl);

            await prisma.linkedAccount.update({
              where: { id: account.id },
              data: {
                webhookSubscriptionId: newSub.id,
                webhookExpiresAt: new Date(newSub.expirationDateTime),
              },
            });
          } catch {
            console.error(`Failed to recreate webhook for account ${account.id}`);
          }
        }
      }

      return;
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`Webhook job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
