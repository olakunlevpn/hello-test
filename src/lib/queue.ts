import { Queue } from "bullmq";
import { redis } from "./redis";

export const tokenRefreshQueue = new Queue("token-refresh", {
  connection: redis,
});

export const webhookProcessingQueue = new Queue("webhook-processing", {
  connection: redis,
});

export async function setupRecurringJobs(): Promise<void> {
  // Urgent refresh: every 10 minutes — catches tokens expiring within 15 minutes
  await tokenRefreshQueue.upsertJobScheduler("refresh-all", {
    every: 10 * 60 * 1000, // 10 minutes
  });

  // Proactive refresh: every 12 hours — refreshes ALL active tokens as safety net
  // Prevents token death if the 30-min worker was down for a while
  await tokenRefreshQueue.upsertJobScheduler("proactive-refresh-all", {
    every: 12 * 60 * 60 * 1000, // 12 hours
  });

  // Webhook renewal: every 48 hours
  await webhookProcessingQueue.upsertJobScheduler("renew-webhooks", {
    every: 48 * 60 * 60 * 1000, // 48 hours
  });
}
