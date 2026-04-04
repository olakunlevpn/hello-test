"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ExternalLink } from "lucide-react";
import StatsCards from "../components/StatsCards";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

interface AccountSummary {
  id: string;
  email: string;
  displayName: string;
  status: string;
  lastRefreshedAt: string | null;
  tokenExpiresAt: string;
  webhookSubscriptionId: string | null;
}

interface DashboardStats {
  totalAccounts: number;
  activeAccounts: number;
  needsReauthAccounts: number;
  revokedAccounts: number;
  activeWebhooks: number;
  healthyTokens: number;
  subscriptionStatus: string | null;
  subscriptionExpires: string | null;
  accounts: AccountSummary[];
}

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStats = () => {
    setLoading(true);
    setError(false);
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) {
          setError(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (data) setStats(data);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchStats();
  }, [status]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-20">
        <p className="text-muted-foreground">{t("loadFailed")}</p>
        <Button variant="outline" onClick={fetchStats}>{t("retry")}</Button>
      </div>
    );
  }

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="default" className="bg-green-600">{t("statusActive")}</Badge>;
      case "NEEDS_REAUTH":
        return <Badge variant="destructive">{t("statusNeedsReauth")}</Badge>;
      case "REVOKED":
        return <Badge variant="secondary">{t("statusRevoked")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("overview")}</h1>

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>{t("connectedAccounts")}</CardTitle>
          <CardDescription>
            {stats.totalAccounts} {t("totalAccounts").toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {stats.accounts.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">
              {t("noAccounts")}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("tokenHealth")}</TableHead>
                  <TableHead>{t("lastSynced")}</TableHead>
                  <TableHead>{t("activeWebhooks")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="font-medium">
                      {account.displayName}
                    </TableCell>
                    <TableCell>{account.email}</TableCell>
                    <TableCell>{statusBadge(account.status)}</TableCell>
                    <TableCell>
                      {account.lastRefreshedAt
                        ? new Date(account.lastRefreshedAt).toLocaleString()
                        : "—"}
                    </TableCell>
                    <TableCell>
                      {account.webhookSubscriptionId ? (
                        <Badge variant="outline" className="text-green-500">{t("active")}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">{t("none")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {account.status === "ACTIVE" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() =>
                            window.open(`/email/${account.id}`, "_blank")
                          }
                        >
                          <ExternalLink className="mr-2 h-3 w-3" />
                          {t("viewEmail")}
                        </Button>
                      )}
                      {account.status === "NEEDS_REAUTH" && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() =>
                            (window.location.href = "/api/auth/microsoft/redirect")
                          }
                        >
                          {t("reconnect")}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
