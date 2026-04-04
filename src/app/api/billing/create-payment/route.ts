import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getUserId } from "@/lib/auth";
import { generatePaymentAddress, getBTCPriceUSD, usdToBTC } from "@/lib/bitgo";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { safeError } from "@/lib/api-error";

export async function POST(request: NextRequest) {
  const rl = rateLimit(`payment:${getRateLimitKey(request)}`, 5, 60 * 1000);
  if (!rl.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  const userId = await getUserId();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { planInterval } = await request.json();

  if (planInterval !== "MONTHLY" && planInterval !== "YEARLY") {
    return NextResponse.json({ error: "Invalid plan interval" }, { status: 400 });
  }

  // Check for existing pending payment
  const existingPending = await prisma.payment.findFirst({
    where: {
      userId,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
  });

  if (existingPending) {
    return NextResponse.json({
      paymentId: existingPending.id,
      bitcoinAddress: existingPending.bitcoinAddress,
      amountBTC: existingPending.amountBTC,
      amountUSD: existingPending.amountUSD,
      expiresAt: existingPending.expiresAt.toISOString(),
    });
  }

  const priceUSD =
    planInterval === "MONTHLY"
      ? Number(process.env.PLAN_PRICE_MONTHLY_USD) || 29
      : Number(process.env.PLAN_PRICE_YEARLY_USD) || 290;

  try {
    console.error("[create-payment] step 1: getting BTC price...");
    const btcPrice = await getBTCPriceUSD();
    console.error("[create-payment] step 2: BTC price =", btcPrice);
    const amountBTC = usdToBTC(priceUSD, btcPrice);
    console.error("[create-payment] step 3: amount BTC =", amountBTC);
    const bitcoinAddress = await generatePaymentAddress();
    console.error("[create-payment] step 4: address =", bitcoinAddress);

    const payment = await prisma.payment.create({
      data: {
        userId,
        amountUSD: priceUSD,
        amountBTC,
        bitcoinAddress,
        planInterval,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    return NextResponse.json({
      paymentId: payment.id,
      bitcoinAddress,
      amountBTC,
      amountUSD: priceUSD,
      expiresAt: payment.expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("[create-payment]", err instanceof Error ? err.message : err);
    return safeError(err);
  }
}
