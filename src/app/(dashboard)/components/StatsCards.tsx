"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Users,
  ShieldCheck,
  ShieldAlert,
  Webhook,
  Activity,
  CreditCard,
} from "lucide-react";
import { t } from "@/i18n";

interface StatsCardsProps {
  stats: {
    totalAccounts: number;
    activeAccounts: number;
    needsReauthAccounts: number;
    activeWebhooks: number;
    healthyTokens: number;
    subscriptionStatus: string | null;
  };
}

export default function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: t("totalAccounts"),
      value: stats.totalAccounts,
      icon: Users,
      description: `${stats.activeAccounts} active`,
    },
    {
      title: t("activeAccounts"),
      value: stats.activeAccounts,
      icon: ShieldCheck,
    },
    {
      title: t("needsReauth"),
      value: stats.needsReauthAccounts,
      icon: ShieldAlert,
    },
    {
      title: t("tokenHealth"),
      value: `${stats.healthyTokens}/${stats.totalAccounts}`,
      icon: Activity,
      description: "Tokens healthy",
    },
    {
      title: t("activeWebhooks"),
      value: stats.activeWebhooks,
      icon: Webhook,
    },
    {
      title: t("subscription"),
      value: stats.subscriptionStatus || "None",
      icon: CreditCard,
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {card.title}
            </CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
            {card.description && (
              <p className="text-xs text-muted-foreground">{card.description}</p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
