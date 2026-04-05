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
    console.log(`[token-worker] Job: ${job.name} (${job.id})`);

    if (job.name === "proactive-refresh-all") {
      const allActive = await prisma.linkedAccount.findMany({
        where: { status: "ACTIVE" },
      });
      console.log(`[token-worker] Proactive refresh: ${allActive.length} active accounts`);

      for (const account of allActive) {
        const success = await refreshAccountToken(account);
        console.log(`[token-worker] Proactive ${account.email}: ${success ? "OK" : "FAILED"}`);
      }
      return;
    }

    // Default: refresh accounts expiring within 30 minutes
    const accounts = await getAccountsNeedingRefresh();
    console.log(`[token-worker] Refresh check: ${accounts.length} accounts need refresh`);

    for (const account of accounts) {
      const success = await refreshAccountToken(account);
      console.log(`[token-worker] Refresh ${account.email}: ${success ? "OK" : "FAILED"}`);
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
