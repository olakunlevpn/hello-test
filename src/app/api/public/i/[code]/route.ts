import { prisma } from "@/lib/prisma";
import { corsResponse, corsOptions } from "@/lib/cors";

export async function OPTIONS() {
  return corsOptions();
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return corsResponse({ error: "Code is required" }, 400);
  }

  const invitation = await prisma.invitation.findFirst({
    where: { code, status: "ACTIVE" },
  });

  if (!invitation) {
    return corsResponse({ error: "Invitation not found or inactive" }, 404);
  }

  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { views: { increment: 1 } },
  });

  return corsResponse({
    invitationId: invitation.id,
    template: invitation.template,
    documentTitle: invitation.documentTitle,
    docType: invitation.docType,
    senderName: invitation.senderName,
  });
}
