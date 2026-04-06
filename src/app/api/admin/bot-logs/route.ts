import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const url = request.nextUrl;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10) || 1);
  const limit = Math.max(1, Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 100));
  const action = url.searchParams.get("action");
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (action) where.action = action;

  try {
    const [logs, total] = await Promise.all([
      prisma.botLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.botLog.count({ where }),
    ]);

    return NextResponse.json({ logs, total, page, limit });
  } catch {
    return NextResponse.json({ error: "Failed to load logs" }, { status: 500 });
  }
}
