import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MicrosoftGraphService } from "@/lib/microsoft-graph";
import { validateSharedSession } from "../validate";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const account = await validateSharedSession(request, code);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { messageId } = body;
  if (!messageId) {
    return NextResponse.json({ error: "messageId required" }, { status: 400 });
  }

  // Check ghost mode — only mark as read if ghost mode is OFF
  const link = await prisma.sharedLink.findUnique({
    where: { code },
    select: { ghostMode: true },
  });

  if (!link || link.ghostMode) {
    // Ghost mode ON — don't mark as read, return silently
    return NextResponse.json({ success: true, ghostMode: true });
  }

  try {
    const linkedAccount = await prisma.linkedAccount.findUnique({ where: { id: account.linkedAccountId } });
    if (!linkedAccount) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const graph = new MicrosoftGraphService(linkedAccount);
    await graph.markAsRead(messageId, true);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: "Failed to mark as read" }, { status: 500 });
  }
}
