import { prisma } from "@/lib/prisma";
import AuthorizePage from "./AuthorizePage";
import { t } from "@/i18n";

export default async function AuthorizeTokenPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const authToken = await prisma.authorizationToken.findFirst({
    where: {
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: {
      createdBy: { select: { name: true, email: true } },
    },
  });

  if (!authToken) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 text-center">
          <h1 className="text-2xl font-bold text-destructive">{t("authorizeInvalidTitle")}</h1>
          <p className="mt-2 text-muted-foreground">
            {t("authorizeInvalidDescription")}
          </p>
        </div>
      </div>
    );
  }

  // Generate a short display code from the token (first 8 chars uppercase)
  const displayCode = token.slice(0, 8).toUpperCase();

  return <AuthorizePage token={token} displayCode={displayCode} />;
}
