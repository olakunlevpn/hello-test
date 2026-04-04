import { NextRequest, NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/prisma";
import { getRequiredConfirmations } from "@/lib/bitgo";

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text();

    // Verify BitGo webhook signature (mandatory)
    const signature = request.headers.get("x-bitgo-signature") || "";
    const secret = process.env.BITGO_WEBHOOK_SECRET;
    if (!secret) {
      return new NextResponse(null, { status: 500 });
    }
    const expectedSignature = createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    const sigBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
      return new NextResponse(null, { status: 401 });
    }

    const body = JSON.parse(rawBody);

    // BitGo webhook payload contains transfer data
    // type: "transfer" for incoming transfers
    // state: "confirmed" when confirmed on-chain
    // confirmations: number of block confirmations
    const { type, hash, state, confirmations, entries } = body;

    // Only process transfer webhooks
    if (type !== "transfer") {
      return new NextResponse(null, { status: 200 });
    }

    // Check required confirmations
    const requiredConfirmations = getRequiredConfirmations();
    if (
      state !== "confirmed" &&
      (!confirmations || confirmations < requiredConfirmations)
    ) {
      // Not enough confirmations yet — BitGo will send another webhook when confirmed
      return new NextResponse(null, { status: 200 });
    }

    // Extract receiving addresses from entries
    // entries is an array of { address, value, valueString, ... }
    // We look for entries where value > 0 (incoming transfers)
    const receivingAddresses: string[] = [];
    if (Array.isArray(entries)) {
      for (const entry of entries) {
        if (entry.value > 0 && entry.address) {
          receivingAddresses.push(entry.address);
        }
      }
    }

    // Also check for flat address field (older webhook format)
    if (body.address && !receivingAddresses.includes(body.address)) {
      receivingAddresses.push(body.address);
    }

    if (receivingAddresses.length === 0) {
      return new NextResponse(null, { status: 200 });
    }

    // Find matching pending payments by address
    for (const address of receivingAddresses) {
      const payment = await prisma.payment.findFirst({
        where: { bitcoinAddress: address, status: "PENDING" },
      });

      if (!payment) continue;

      // Idempotency: skip if already confirmed
      if (payment.status === "CONFIRMED") continue;

      // Atomic: confirm payment + create/extend subscription in a transaction
      const periodMs =
        payment.planInterval === "MONTHLY"
          ? 30 * 24 * 60 * 60 * 1000
          : 365 * 24 * 60 * 60 * 1000;

      await prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "CONFIRMED",
            txHash: hash || body.txid || null,
            confirmedAt: new Date(),
          },
        });

        const existingSub = await tx.subscription.findUnique({
          where: { userId: payment.userId },
        });

        const now = new Date();
        const periodStart =
          existingSub &&
          existingSub.status === "ACTIVE" &&
          existingSub.currentPeriodEnd > now
            ? existingSub.currentPeriodEnd
            : now;
        const periodEnd = new Date(periodStart.getTime() + periodMs);

        await tx.subscription.upsert({
          where: { userId: payment.userId },
          update: {
            plan: payment.planInterval,
            status: "ACTIVE",
            currentPeriodStart: periodStart,
            currentPeriodEnd: periodEnd,
          },
          create: {
            userId: payment.userId,
            plan: payment.planInterval,
            status: "ACTIVE",
            currentPeriodStart: now,
            currentPeriodEnd: periodEnd,
          },
        });
      });
    }

    return new NextResponse(null, { status: 200 });
  } catch {
    // Return 500 so BitGo retries the webhook
    return new NextResponse(null, { status: 500 });
  }
}
