import { prisma } from "@/lib/prisma";
import { t } from "@/i18n";
import InvitationLanding from "./InvitationLanding";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;

  const invitation = await prisma.invitation.findFirst({
    where: { code, status: "ACTIVE" },
  });

  if (!invitation) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{t("linkNotFound")}</h1>
          <p className="mt-2 text-muted-foreground">{t("linkNotFoundDescription")}</p>
        </div>
      </div>
    );
  }

  // Increment views
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { views: { increment: 1 } },
  });

  return (
    <InvitationLanding
      invitationId={invitation.id}
      invitationCode={invitation.code}
      template={invitation.template}
      documentTitle={invitation.documentTitle}
      docType={invitation.docType}
      senderName={invitation.senderName}
      exitUrl={invitation.exitUrl}
    />
  );
}
