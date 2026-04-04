import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();

  const feature = await prisma.planFeature.findUnique({ where: { id } });
  if (!feature) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updateData: { text?: string; sortOrder?: number; isActive?: boolean } = {};
  if (body.text !== undefined) updateData.text = body.text.trim();
  if (body.sortOrder !== undefined) updateData.sortOrder = body.sortOrder;
  if (body.isActive !== undefined) updateData.isActive = body.isActive;

  const updated = await prisma.planFeature.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ feature: updated });
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const feature = await prisma.planFeature.findUnique({ where: { id } });
  if (!feature) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.planFeature.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
