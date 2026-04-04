"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
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
import {
  Radar,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Wifi,
  WifiOff,
  Zap,
  Activity,
  Mail,
  Clock,
} from "lucide-react";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
  tokenExpiresAt: string;
  lastRefreshedAt: string | null;
  webhookSubscriptionId: string | null;
  webhookExpiresAt: string | null;
  isOrgAdmin: boolean;
  orgRoles: string[];
  createdAt: string;
}

interface ActivityCount {
  accountId: string;
  count: number;
  lastAction: string | null;
}

export default function AccountIntelPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [activityCounts, setActivityCounts] = useState<Map<string, ActivityCount>>(new Map());
  const [ruleCounts, setRuleCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status !== "authenticated") return;

    Promise.all([
      fetch("/api/accounts").then((r) => r.ok ? r.json() : null),
      fetch("/api/activity-log?limit=500").then((r) => r.ok ? r.json() : null),
    ])
      .then(([accountsData, activityData]) => {
        const accs: Account[] = accountsData?.accounts || [];
        setAccounts(accs);

        // Count activity per account
        const counts = new Map<string, ActivityCount>();
        for (const log of activityData?.logs || []) {
          const existing = counts.get(log.linkedAccountId);
          if (existing) {
            existing.count++;
            if (!existing.lastAction || log.createdAt > existing.lastAction) {
              existing.lastAction = log.createdAt;
            }
          } else {
            counts.set(log.linkedAccountId, { accountId: log.linkedAccountId, count: 1, lastAction: log.createdAt });
          }
        }
        setActivityCounts(counts);

        // Load rule counts per account
        const rCounts = new Map<string, number>();
        Promise.all(
          accs.filter((a) => a.status === "ACTIVE").map((a) =>
            fetch(`/api/rules?accountId=${a.id}`)
              .then((r) => r.ok ? r.json() : null)
              .then((data) => {
                if (data?.rules) {
                  rCounts.set(a.id, data.rules.filter((r: { isActive: boolean }) => r.isActive).length);
                }
              })
              .catch(() => {})
          )
        ).then(() => setRuleCounts(new Map(rCounts)));
      })
      .catch(() => toast.error(t("error")))
      .finally(() => setLoading(false));
  }, [status]);

  const getTokenHealth = (account: Account) => {
    if (account.status !== "ACTIVE") return { label: account.status, color: "text-red-500", icon: ShieldOff };
    const minutes = Math.floor((new Date(account.tokenExpiresAt).getTime() - Date.now()) / 60000);
    if (minutes > 20) return { label: `${t("healthy")} (${minutes}m)`, color: "text-green-500", icon: ShieldCheck };
    if (minutes > 0) return { label: `${t("expiring")} (${minutes}m)`, color: "text-yellow-500", icon: ShieldAlert };
    return { label: t("expired"), color: "text-red-500", icon: ShieldOff };
  };

  const getWebhookStatus = (account: Account) => {
    if (!account.webhookSubscriptionId) return { label: t("noWebhook"), color: "text-muted-foreground", icon: WifiOff };
    const hours = account.webhookExpiresAt ? Math.floor((new Date(account.webhookExpiresAt).getTime() - Date.now()) / 3600000) : 0;
    if (hours > 24) return { label: `${t("active")} (${hours}h)`, color: "text-green-500", icon: Wifi };
    if (hours > 0) return { label: `${t("expiring")} (${hours}h)`, color: "text-yellow-500", icon: Wifi };
    return { label: t("expired"), color: "text-red-500", icon: WifiOff };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  const totalActions = Array.from(activityCounts.values()).reduce((sum, c) => sum + c.count, 0);
  const totalRules = Array.from(ruleCounts.values()).reduce((sum, c) => sum + c, 0);
  const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;
  const adminCount = accounts.filter((a) => a.isOrgAdmin).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Radar className="h-7 w-7" />
        {t("accountIntel")}
      </h1>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">{t("totalAccounts")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-500">{activeCount}</div>
            <p className="text-xs text-muted-foreground">{t("activeAccounts")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-purple-500">{adminCount}</div>
            <p className="text-xs text-muted-foreground">{t("orgAdmin")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{totalRules}</div>
            <p className="text-xs text-muted-foreground">{t("intelRulesActive")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-500">{totalActions}</div>
            <p className="text-xs text-muted-foreground">{t("intelTotalActions")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Per-account intel */}
      <Card>
        <CardHeader>
          <CardTitle>{t("accountIntel")}</CardTitle>
          <CardDescription>{t("accountIntelDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("noAccounts")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("intelTokenStatus")}</TableHead>
                  <TableHead>{t("intelWebhookStatus")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("intelRulesActive")}</TableHead>
                  <TableHead>{t("intelTotalActions")}</TableHead>
                  <TableHead>{t("intelLastActivity")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => {
                  const token = getTokenHealth(account);
                  const webhook = getWebhookStatus(account);
                  const activity = activityCounts.get(account.id);
                  const rules = ruleCounts.get(account.id) || 0;
                  const TokenIcon = token.icon;
                  const WebhookIcon = webhook.icon;

                  return (
                    <TableRow key={account.id}>
                      <TableCell>
                        <div>
                          <div className="text-sm font-medium">{account.email}</div>
                          <div className="text-xs text-muted-foreground">{account.displayName}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <TokenIcon className={`h-3 w-3 ${token.color}`} />
                          <span className={`text-xs ${token.color}`}>{token.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <WebhookIcon className={`h-3 w-3 ${webhook.color}`} />
                          <span className={`text-xs ${webhook.color}`}>{webhook.label}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        {account.isOrgAdmin ? (
                          <Badge className="bg-purple-600 text-[10px]">{t("orgAdmin")}</Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px]">{t("orgUser")}</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-blue-500" />
                          <span className="text-sm">{rules}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Activity className="h-3 w-3 text-orange-500" />
                          <span className="text-sm">{activity?.count || 0}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {activity?.lastAction ? (
                          <div className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {new Date(activity.lastAction).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                          </div>
                        ) : "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
