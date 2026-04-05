"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
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
import { toast } from "sonner";
import {
  ChartConfig,
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from "@/components/ui/chart";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";

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

interface ChartData {
  accountStatus: { active: number; needsReauth: number; revoked: number };
  activityTimeline: { date: string; actions: number }[];
  topActions: { action: string; count: number }[];
  ruleTriggered: { name: string; triggers: number }[];
  invitationPerformance: { name: string; views: number; auths: number }[];
}

const activityConfig: ChartConfig = {
  actions: { label: "Actions", color: "#84cc16" },
};

const accountStatusConfig: ChartConfig = {
  active: { label: "Active", color: "#22c55e" },
  needsReauth: { label: "Needs Reauth", color: "#ef4444" },
  revoked: { label: "Revoked", color: "#6b7280" },
};

const topActionsConfig: ChartConfig = {
  count: { label: "Count", color: "#84cc16" },
};

const invitationConfig: ChartConfig = {
  views: { label: "Views", color: "#3b82f6" },
  auths: { label: "Auths", color: "#84cc16" },
};

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

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
    setChartLoading(true);
    fetch("/api/stats/charts")
      .then((r) => {
        if (!r.ok) throw new Error("chart fetch failed");
        return r.json();
      })
      .then((data: ChartData) => {
        setChartData(data);
        setChartLoading(false);
      })
      .catch(() => {
        toast.error(t("loadFailed"));
        setChartLoading(false);
      });
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

  const hasChartData =
    chartData &&
    (chartData.activityTimeline.some((d) => d.actions > 0) ||
      chartData.accountStatus.active > 0 ||
      chartData.accountStatus.needsReauth > 0 ||
      chartData.accountStatus.revoked > 0 ||
      chartData.topActions.length > 0 ||
      chartData.invitationPerformance.length > 0);

  const accountStatusPieData = chartData
    ? [
        { name: "Active", value: chartData.accountStatus.active, fill: "#22c55e" },
        { name: "Needs Reauth", value: chartData.accountStatus.needsReauth, fill: "#ef4444" },
        { name: "Revoked", value: chartData.accountStatus.revoked, fill: "#6b7280" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("overview")}</h1>

      <StatsCards stats={stats} />

      <Card>
        <CardHeader>
          <CardTitle>{t("connectedAccounts")}</CardTitle>
          <p className="text-sm text-muted-foreground">
            {stats.totalAccounts} {t("totalAccounts").toLowerCase()}
          </p>
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

      {!chartLoading && hasChartData && (
        <div className="grid grid-cols-2 gap-4">
          {/* Activity Timeline */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={activityConfig}>
                <AreaChart data={chartData!.activityTimeline}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Area
                    type="monotone"
                    dataKey="actions"
                    stroke="#84cc16"
                    fill="#84cc16"
                    fillOpacity={0.2}
                  />
                </AreaChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle>Account Status</CardTitle>
            </CardHeader>
            <CardContent>
              <ChartContainer config={accountStatusConfig}>
                <PieChart>
                  <Pie
                    data={accountStatusPieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                  >
                    {accountStatusPieData.map((entry, index) => (
                      <Cell key={index} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
          </Card>

          {/* Top Actions */}
          {chartData!.topActions.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Actions</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topActionsConfig}>
                  <BarChart
                    data={chartData!.topActions}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="action"
                      tick={{ fontSize: 10 }}
                      width={100}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#84cc16" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Invitation Performance */}
          {chartData!.invitationPerformance.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Invitation Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={invitationConfig}>
                  <BarChart data={chartData!.invitationPerformance}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="views" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="auths" fill="#84cc16" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
