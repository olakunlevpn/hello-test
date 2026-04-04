import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tokens = await prisma.authorizationToken.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      createdBy: { select: { id: true, name: true, email: true } },
      usedBy: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest) {
  let adminId: string;
  try {
    adminId = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const expiresInHours = Number(body.expiresInHours) || 24;

  const token = randomBytes(16).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);

  const authToken = await prisma.authorizationToken.create({
    data: {
      token,
      createdById: adminId,
      expiresAt,
    },
    select: {
      id: true,
      token: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ token: authToken }, { status: 201 });
}
