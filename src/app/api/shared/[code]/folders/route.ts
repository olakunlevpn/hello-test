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

  try {
    const linkedAccount = await prisma.linkedAccount.findUnique({ where: { id: account.linkedAccountId } });
    if (!linkedAccount) return NextResponse.json({ error: "Account not found" }, { status: 404 });

    const graph = new MicrosoftGraphService(linkedAccount);
    const folders = await graph.getFolders();

    return NextResponse.json({ folders });
  } catch {
    return NextResponse.json({ error: "Failed to load folders" }, { status: 500 });
  }
}
