import "./env";
import { Worker } from "bullmq";
import Redis from "ioredis";
import {
  refreshAccountToken,
  getAccountsNeedingRefresh,
} from "../lib/token-manager";
import { setupRecurringJobs } from "../lib/queue";
import { prisma } from "../lib/prisma";

const connection = new Redis(process.env.REDIS_URL || "redis://localhost:6379", {
  maxRetriesPerRequest: null,
});

// Register recurring job schedules on startup
setupRecurringJobs().catch((err) =>
  console.error("Failed to setup recurring jobs:", err.message)
);

const worker = new Worker(
  "token-refresh",
  async (job) => {
    if (job.name === "proactive-refresh-all") {
      // Daily proactive refresh: refresh ALL active tokens regardless of expiry
      // This prevents tokens from dying if the worker was down for a while
      const allActive = await prisma.linkedAccount.findMany({
        where: { status: "ACTIVE" },
      });

      for (const account of allActive) {
        const success = await refreshAccountToken(account);
        if (!success) {
          console.error(
            `Proactive refresh failed for account ${account.id} (${account.email})`
          );
        }
      }
      return;
    }

    // Default: refresh only accounts expiring soon
    const accounts = await getAccountsNeedingRefresh();

    for (const account of accounts) {
      const success = await refreshAccountToken(account);
      if (!success) {
        console.error(
          `Token refresh failed for account ${account.id} (${account.email})`
        );
      }
    }
  },
  { connection }
);

worker.on("failed", (job, err) => {
  console.error(`Token refresh job ${job?.id} failed:`, err.message);
});

async function shutdown() {
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
