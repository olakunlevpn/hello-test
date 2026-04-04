import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const features = await prisma.planFeature.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, text: true },
  });

  return NextResponse.json({ features });
}
