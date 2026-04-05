import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const domains = await prisma.customDomain.findMany({
    where: { isGlobal: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ domains });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { domain } = await request.json();
  if (!domain || !DOMAIN_REGEX.test(domain.trim())) {
    return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
  }

  const normalized = domain.trim().toLowerCase();
  const existing = await prisma.customDomain.findUnique({ where: { domain: normalized } });
  if (existing) {
    return NextResponse.json({ error: "Domain already exists" }, { status: 409 });
  }

  const newDomain = await prisma.customDomain.create({
    data: {
      userId,
      domain: normalized,
      verified: false,
      sslActive: false,
      isGlobal: true,
    },
  });

  return NextResponse.json({ domain: newDomain }, { status: 201 });
}
