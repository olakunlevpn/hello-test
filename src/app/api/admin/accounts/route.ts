import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10));
  const status = searchParams.get("status");

  const where = status ? { status: status as "ACTIVE" | "NEEDS_REAUTH" | "REVOKED" } : {};

  const [accounts, total] = await Promise.all([
    prisma.linkedAccount.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { id: true, email: true, name: true } },
      },
    }),
    prisma.linkedAccount.count({ where }),
  ]);

  return NextResponse.json({
    accounts,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  });
}
