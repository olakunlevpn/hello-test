import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { t } from "@/i18n";

export default function Forbidden() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8 px-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
            <ShieldAlert className="h-8 w-8 text-destructive" />
          </div>
          <p className="text-6xl font-bold text-destructive/20 mb-4">403</p>
          <h1 className="text-2xl font-bold mb-2">{t("forbidden")}</h1>
          <p className="text-sm text-muted-foreground/60 italic mb-8">{t("forbiddenSubtext")}</p>
          <Button asChild>
            <Link href="/">{t("back")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
