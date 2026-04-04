import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const features = await prisma.planFeature.findMany({
    orderBy: { sortOrder: "asc" },
  });

  return NextResponse.json({ features });
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { text } = await request.json();

  if (!text || !text.trim()) {
    return NextResponse.json({ error: "Feature text is required" }, { status: 400 });
  }

  const maxOrder = await prisma.planFeature.aggregate({ _max: { sortOrder: true } });
  const nextOrder = (maxOrder._max.sortOrder || 0) + 1;

  const feature = await prisma.planFeature.create({
    data: { text: text.trim(), sortOrder: nextOrder },
  });

  return NextResponse.json({ feature }, { status: 201 });
}
