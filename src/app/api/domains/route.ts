import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Return user's own domains + all global (admin) domains that are verified
    const domains = await prisma.customDomain.findMany({
      where: {
        OR: [
          { userId },
          { isGlobal: true, verified: true },
        ],
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ domains });
  } catch {
    return NextResponse.json({ domains: [] });
  }
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { domain } = body;

  if (!domain || !DOMAIN_REGEX.test(domain.trim())) {
    return NextResponse.json({ error: "INVALID_DOMAIN" }, { status: 400 });
  }

  const normalized = domain.trim().toLowerCase();

  const existing = await prisma.customDomain.findUnique({
    where: { domain: normalized },
  });

  if (existing) {
    return NextResponse.json({ error: "DOMAIN_EXISTS" }, { status: 409 });
  }

  const newDomain = await prisma.customDomain.create({
    data: {
      userId,
      domain: normalized,
      verified: false,
    },
  });

  return NextResponse.json({ domain: newDomain }, { status: 201 });
}
