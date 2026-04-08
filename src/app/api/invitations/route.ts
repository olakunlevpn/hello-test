import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { readdirSync } from "fs";
import { join } from "path";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

export async function GET() {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const invitations = await prisma.invitation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invitations });
}

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { name, template, docType, documentTitle, senderName, notes, exitUrl, domainId } = body;

  if (!name || !documentTitle || !senderName) {
    return NextResponse.json({ error: "Name, document title, and sender name are required" }, { status: 400 });
  }

  if (!template) {
    return NextResponse.json({ error: "Template is required" }, { status: 400 });
  }

  try {
    const templatesDir = join(process.cwd(), "invitation-templates");
    const entries = readdirSync(templatesDir, { withFileTypes: true });
    const validTemplates = entries.filter((e) => e.isDirectory()).map((e) => e.name);
    if (!validTemplates.includes(template)) {
      return NextResponse.json({ error: "Invalid template" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid template" }, { status: 400 });
  }

  const code = randomBytes(8).toString("hex");

  // Validate domainId — user owns it OR it's a verified global domain
  if (domainId) {
    const domain = await prisma.customDomain.findFirst({
      where: {
        id: domainId,
        OR: [
          { userId },
          { isGlobal: true, verified: true },
        ],
      },
    });
    if (!domain) {
      return NextResponse.json({ error: "Invalid domain" }, { status: 400 });
    }
  }

  const invitation = await prisma.invitation.create({
    data: {
      code,
      userId,
      name,
      template,
      docType: docType || "PDF",
      documentTitle,
      senderName,
      notes: notes || null,
      exitUrl: exitUrl || null,
      domainId: domainId || null,
    },
  });

  return NextResponse.json({ invitation }, { status: 201 });
}
