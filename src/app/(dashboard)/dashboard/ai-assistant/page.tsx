"use client";

import { Bot } from "lucide-react";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { t } from "@/i18n";

export default function AiAssistantPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Bot className="h-7 w-7" />
        {t("aiAssistant")}
      </h1>

      <Card>
        <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
          <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-8 w-8 text-muted-foreground" />
          </div>
          <h2 className="text-lg font-semibold">{t("comingSoon")}</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {t("aiAssistant")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
