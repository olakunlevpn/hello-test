import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "UNAUTHORIZED";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const { token } = body;

  if (!token || typeof token !== "string") {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const authToken = await prisma.authorizationToken.findUnique({
    where: { token },
  });

  if (!authToken) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  if (authToken.usedAt) {
    return NextResponse.json({ error: "Token already used" }, { status: 400 });
  }

  if (authToken.expiresAt < new Date()) {
    return NextResponse.json({ error: "Invalid or expired token" }, { status: 400 });
  }

  await prisma.authorizationToken.update({
    where: { id: authToken.id },
    data: {
      usedById: userId,
      usedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, redirectUrl: "/api/auth/microsoft/redirect" });
}
