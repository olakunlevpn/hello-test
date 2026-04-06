import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const link = await prisma.sharedLink.findFirst({ where: { id, userId } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const data: Record<string, unknown> = {};

  // Toggle status
  if (body.status === "ACTIVE" || body.status === "SUSPENDED") {
    data.status = body.status;
  }

  // Reset password
  if (body.password && body.password.length >= 4) {
    data.passwordHash = await hashPassword(body.password);
  }

  // Update label
  if (body.label !== undefined) {
    data.label = body.label || null;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No changes" }, { status: 400 });
  }

  try {
    const updated = await prisma.sharedLink.update({ where: { id }, data });
    return NextResponse.json({ link: updated });
  } catch {
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const link = await prisma.sharedLink.findFirst({ where: { id, userId } });
  if (!link) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.sharedLink.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
