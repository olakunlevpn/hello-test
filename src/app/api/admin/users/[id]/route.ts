import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { hashPassword } from "@/lib/password";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      subscription: true,
      linkedAccounts: {
        select: {
          id: true,
          email: true,
          displayName: true,
          status: true,
          lastRefreshedAt: true,
          tokenExpiresAt: true,
          webhookSubscriptionId: true,
          webhookExpiresAt: true,
          createdAt: true,
        },
      },
      payments: {
        orderBy: { createdAt: "desc" },
        take: 20,
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ user });
}

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
  const { name, email, role, status, newPassword, subscriptionAction, extendDays } = body;

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Handle password reset
  if (newPassword && newPassword.length >= 8) {
    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id },
      data: { passwordHash },
    });
  }

  // Handle email update (check for duplicates)
  if (email && email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "Email already in use by another account" },
        { status: 409 }
      );
    }
  }

  if (subscriptionAction === "extend") {
    const days = typeof extendDays === "number" ? extendDays : 30;
    const existing = await prisma.subscription.findUnique({ where: { userId: id } });

    if (existing && existing.status === "ACTIVE") {
      const newEnd = new Date(existing.currentPeriodEnd);
      newEnd.setDate(newEnd.getDate() + days);
      await prisma.subscription.update({
        where: { userId: id },
        data: { currentPeriodEnd: newEnd, status: "ACTIVE" },
      });
    } else {
      const now = new Date();
      const end = new Date();
      end.setDate(end.getDate() + days);
      await prisma.subscription.upsert({
        where: { userId: id },
        update: {
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
        create: {
          userId: id,
          plan: "MONTHLY",
          status: "ACTIVE",
          currentPeriodStart: now,
          currentPeriodEnd: end,
        },
      });
    }
  } else if (subscriptionAction === "revoke") {
    await prisma.subscription.updateMany({
      where: { userId: id },
      data: { status: "CANCELLED" },
    });
  }

  const updateData: {
    name?: string;
    email?: string;
    role?: "USER" | "ADMIN";
    status?: "ACTIVE" | "SUSPENDED" | "BLOCKED";
  } = {};
  if (name !== undefined) updateData.name = name;
  if (email && email !== user.email) updateData.email = email;
  if (role === "USER" || role === "ADMIN") updateData.role = role;
  if (status === "ACTIVE" || status === "SUSPENDED" || status === "BLOCKED") updateData.status = status;

  const updated = await prisma.user.update({
    where: { id },
    data: updateData,
    include: { subscription: true },
  });

  return NextResponse.json({ user: updated });
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

  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.user.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
