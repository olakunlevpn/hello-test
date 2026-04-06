import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { t } from "@/i18n";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
      <Card className="w-full max-w-md text-center">
        <CardContent className="pt-10 pb-8 px-8">
          <p className="text-8xl font-bold text-primary/20 mb-6">404</p>
          <h1 className="text-2xl font-bold mb-2">{t("pageNotFound")}</h1>
          <p className="text-muted-foreground mb-2">{t("pageNotFoundDesc")}</p>
          <p className="text-sm text-muted-foreground/60 italic mb-8">{t("pageNotFoundSubtext")}</p>
          <Link href="/">
            <Button>{t("back")}</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
