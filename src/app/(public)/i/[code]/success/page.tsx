import { Check, Mail } from "lucide-react";
import { t } from "@/i18n";

export default function InvitationSuccessPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-600/10">
          <Check className="h-10 w-10 text-green-500" />
        </div>
        <h1 className="text-3xl font-bold">{t("accountConnectedTitle")}</h1>
        <p className="text-muted-foreground">
          {t("accountConnectedDescription")}
        </p>
        <div className="flex items-center justify-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 p-4">
          <Mail className="h-5 w-5 text-green-500" />
          <span className="text-sm">{t("verificationComplete")}</span>
        </div>
      </div>
    </div>
  );
}
