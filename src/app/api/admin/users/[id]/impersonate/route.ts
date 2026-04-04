import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { encode } from "next-auth/jwt";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const targetUser = await prisma.user.findUnique({ where: { id } });
  if (!targetUser) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const token = await encode({
    token: {
      userId: targetUser.id,
      role: targetUser.role,
      email: targetUser.email,
      name: targetUser.name,
      impersonatedBy: "admin",
    },
    secret: process.env.NEXTAUTH_SECRET!,
  });

  return NextResponse.json({
    token,
    user: {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name,
      role: targetUser.role,
    },
  });
}
