import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

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
  const body = await request.json();

  if (body.status && !["ACTIVE", "PAUSED", "EXPIRED"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findFirst({ where: { id, userId } });
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const updated = await prisma.invitation.update({
    where: { id },
    data: { status: body.status },
  });

  return NextResponse.json({ invitation: updated });
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

  const invitation = await prisma.invitation.findFirst({ where: { id, userId } });
  if (!invitation) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Delete Cloudflare Pages project if deployed
  if (invitation.deployedUrl) {
    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { cloudflareApiToken: true, cloudflareAccountId: true },
      });
      if (user?.cloudflareApiToken && user?.cloudflareAccountId) {
        const apiToken = decrypt(user.cloudflareApiToken);
        const projectName = `inv-${invitation.code.slice(0, 12)}`;
        await fetch(
          `https://api.cloudflare.com/client/v4/accounts/${user.cloudflareAccountId}/pages/projects/${projectName}`,
          { method: "DELETE", headers: { Authorization: `Bearer ${apiToken}` } }
        );
      }
    } catch {
      // Non-critical — continue with deletion
    }
  }

  await prisma.invitation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
