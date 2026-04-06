import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { MicrosoftGraphService } from "@/lib/microsoft-graph";
import { validateSharedSession } from "../validate";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const account = await validateSharedSession(request, code);
  if (!account) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl;
  const folderId = url.searchParams.get("folderId") || "inbox";
  const skip = parseInt(url.searchParams.get("skip") || "0", 10);
  const top = Math.min(parseInt(url.searchParams.get("top") || "25", 10), 50);

  try {
    const linkedAccount = await prisma.linkedAccount.findUnique({ where: { id: account.linkedAccountId } });
    if (!linkedAccount) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const graph = new MicrosoftGraphService(linkedAccount);
    const messages = await graph.getMessages({ folderId, skip, top });

    return NextResponse.json(messages);
  } catch {
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
