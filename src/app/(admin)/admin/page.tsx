"use client";

import { useEffect, useState } from "react";
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
import { Badge } from "@/components/ui/badge";
import {
  Users,
  Link2,
  ShieldCheck,
  ShieldAlert,
  CreditCard,
  DollarSign,
  Webhook,
  Clock,
  Shield,
  Ban,
} from "lucide-react";
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

interface RecentUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  createdAt: string;
  _count: { linkedAccounts: number };
  subscription: { status: string } | null;
}

interface AdminStats {
  totalUsers: number;
  totalLinkedAccounts: number;
  activeAccounts: number;
  needsReauthAccounts: number;
  activeSubscriptions: number;
  expiredSubscriptions: number;
  totalRevenue: number;
  pendingPayments: number;
  confirmedPayments: number;
  activeWebhooks: number;
  recentUsers: RecentUser[];
}

interface AdminChartData {
  userGrowth: { date: string; signups: number }[];
  revenueTimeline: { date: string; revenue: number }[];
  accountStatus: { active: number; needsReauth: number; revoked: number };
  subscriptionStatus: { active: number; expired: number; cancelled: number };
  subscriptionPlans: { monthly: number; yearly: number };
  webhookTimeline: { date: string; processed: number; failed: number }[];
  topUsersByAccounts: { name: string; accounts: number }[];
  botBlocksByDay: { date: string; blocked: number }[];
  botBlocksTotal: number;
  botBlocksToday: number;
  botTopCountries: { country: string; count: number }[];
  botReasonBreakdown: { reason: string; count: number }[];
}

const userGrowthConfig: ChartConfig = {
  signups: { label: "Signups", color: "#84cc16" },
};

const revenueConfig: ChartConfig = {
  revenue: { label: "Revenue", color: "#22c55e" },
};

const subscriptionStatusConfig: ChartConfig = {
  active: { label: "Active", color: "#22c55e" },
  expired: { label: "Expired", color: "#ef4444" },
  cancelled: { label: "Cancelled", color: "#6b7280" },
};

const accountStatusConfig: ChartConfig = {
  active: { label: "Active", color: "#22c55e" },
  needsReauth: { label: "Needs Reauth", color: "#ef4444" },
  revoked: { label: "Revoked", color: "#6b7280" },
};

const webhookConfig: ChartConfig = {
  processed: { label: "Processed", color: "#22c55e" },
  failed: { label: "Failed", color: "#ef4444" },
};

const topUsersConfig: ChartConfig = {
  accounts: { label: "Accounts", color: "#84cc16" },
};

const botBlocksConfig: ChartConfig = {
  blocked: { label: "Bots Blocked", color: "#f97316" },
};

const botCountryConfig: ChartConfig = {
  count: { label: "Blocked", color: "#ef4444" },
};

const botReasonConfig: ChartConfig = {
  count: { label: "Count", color: "#f97316" },
};

function StatCard({
  icon: Icon,
  label,
  value,
  iconClass,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <Icon className={`h-4 w-4 ${iconClass ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function subscriptionBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">{t("noSubscription")}</Badge>;
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-600">{t("activeSubscription")}</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">{t("expiredSubscriptions")}</Badge>;
    case "CANCELLED":
      return <Badge variant="outline">{t("cancelled")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function roleBadge(role: string) {
  if (role === "ADMIN") return <Badge variant="destructive">ADMIN</Badge>;
  return <Badge variant="outline">USER</Badge>;
}

export default function AdminDashboardPage() {
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  const [chartData, setChartData] = useState<AdminChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch("/api/admin/charts")
      .then((r) => {
        if (!r.ok) throw new Error("chart fetch failed");
        return r.json();
      })
      .then((data: AdminChartData) => {
        setChartData(data);
        setChartLoading(false);
      })
      .catch(() => {
        toast.error(t("loadFailed"));
        setChartLoading(false);
      });
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  const hasChartData =
    chartData &&
    (chartData.userGrowth.some((d) => d.signups > 0) ||
      chartData.revenueTimeline.some((d) => d.revenue > 0) ||
      chartData.accountStatus.active > 0 ||
      chartData.accountStatus.needsReauth > 0 ||
      chartData.accountStatus.revoked > 0 ||
      chartData.subscriptionStatus.active > 0 ||
      chartData.subscriptionStatus.expired > 0 ||
      chartData.subscriptionStatus.cancelled > 0 ||
      chartData.webhookTimeline.some((d) => d.processed > 0 || d.failed > 0) ||
      chartData.topUsersByAccounts.length > 0);

  const subscriptionPieData = chartData
    ? [
        { name: "Active", value: chartData.subscriptionStatus.active, fill: "#22c55e" },
        { name: "Expired", value: chartData.subscriptionStatus.expired, fill: "#ef4444" },
        { name: "Cancelled", value: chartData.subscriptionStatus.cancelled, fill: "#6b7280" },
      ].filter((d) => d.value > 0)
    : [];

  const accountStatusPieData = chartData
    ? [
        { name: "Active", value: chartData.accountStatus.active, fill: "#22c55e" },
        { name: "Needs Reauth", value: chartData.accountStatus.needsReauth, fill: "#ef4444" },
        { name: "Revoked", value: chartData.accountStatus.revoked, fill: "#6b7280" },
      ].filter((d) => d.value > 0)
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("adminDashboard")}</h1>

      <div className="grid grid-cols-4 gap-4">
        <StatCard icon={Users} label={t("totalUsers")} value={stats.totalUsers} />
        <StatCard icon={Link2} label={t("totalAccounts")} value={stats.totalLinkedAccounts} />
        <StatCard
          icon={ShieldCheck}
          label={t("activeSubscriptions")}
          value={stats.activeAccounts}
          iconClass="text-green-500"
        />
        <StatCard
          icon={ShieldAlert}
          label={t("failingTokens")}
          value={stats.needsReauthAccounts}
          iconClass="text-red-500"
        />
        <StatCard
          icon={CreditCard}
          label={t("activeSubscriptions")}
          value={stats.activeSubscriptions}
          iconClass="text-blue-500"
        />
        <StatCard
          icon={DollarSign}
          label={t("totalRevenue")}
          value={`$${Number(stats.totalRevenue).toFixed(2)}`}
          iconClass="text-green-500"
        />
        <StatCard
          icon={Webhook}
          label={t("activeWebhooks")}
          value={stats.activeWebhooks}
        />
        <StatCard
          icon={Clock}
          label={t("paymentPending")}
          value={stats.pendingPayments}
          iconClass="text-yellow-500"
        />
      </div>

      {/* Bot Detection Stats */}
      {chartData && chartData.botBlocksTotal > 0 && (
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={Shield}
            label={t("blockedToday")}
            value={chartData.botBlocksToday}
            iconClass="text-orange-500"
          />
          <StatCard
            icon={Ban}
            label={t("blockedThisMonth")}
            value={chartData.botBlocksTotal}
            iconClass="text-red-500"
          />
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{t("recentUsers")}</CardTitle>
          <CardDescription>{t("recentUsersDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("name")}</TableHead>
                <TableHead>{t("role")}</TableHead>
                <TableHead>{t("accounts")}</TableHead>
                <TableHead>{t("subscription")}</TableHead>
                <TableHead>{t("joined")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.recentUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.email}</TableCell>
                  <TableCell>{user.name ?? "—"}</TableCell>
                  <TableCell>{roleBadge(user.role)}</TableCell>
                  <TableCell>{user._count.linkedAccounts}</TableCell>
                  <TableCell>{subscriptionBadge(user.subscription?.status ?? null)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                </TableRow>
              ))}
              {stats.recentUsers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {!chartLoading && hasChartData && (
        <div className="grid grid-cols-2 gap-4">
          {/* User Growth */}
          {chartData!.userGrowth.some((d) => d.signups > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>User Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={userGrowthConfig}>
                  <AreaChart data={chartData!.userGrowth}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="signups"
                      stroke="#84cc16"
                      fill="#84cc16"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Revenue */}
          {chartData!.revenueTimeline.some((d) => d.revenue > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Revenue</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={revenueConfig}>
                  <AreaChart data={chartData!.revenueTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#22c55e"
                      fill="#22c55e"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Subscription Breakdown */}
          {subscriptionPieData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Subscription Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={subscriptionStatusConfig}>
                  <PieChart>
                    <Pie
                      data={subscriptionPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                    >
                      {subscriptionPieData.map((entry, index) => (
                        <Cell key={index} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                  </PieChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Account Status */}
          {accountStatusPieData.length > 0 && (
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
          )}

          {/* Webhook Activity */}
          {chartData!.webhookTimeline.some((d) => d.processed > 0 || d.failed > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>Webhook Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={webhookConfig}>
                  <BarChart data={chartData!.webhookTimeline}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="processed" stackId="a" fill="#22c55e" />
                    <Bar dataKey="failed" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Top Users by Accounts */}
          {chartData!.topUsersByAccounts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Top Users by Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={topUsersConfig}>
                  <BarChart
                    data={chartData!.topUsersByAccounts}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 10 }}
                      width={120}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="accounts" fill="#84cc16" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Bot Blocks Timeline */}
          {chartData!.botBlocksByDay?.some((d) => d.blocked > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>{t("botDetection")} — {t("blockedThisMonth")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={botBlocksConfig}>
                  <AreaChart data={chartData!.botBlocksByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Area
                      type="monotone"
                      dataKey="blocked"
                      stroke="#f97316"
                      fill="#f97316"
                      fillOpacity={0.2}
                    />
                  </AreaChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Bot Block Reasons */}
          {chartData!.botReasonBreakdown?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("blockReasons")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={botReasonConfig}>
                  <BarChart data={chartData!.botReasonBreakdown}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="reason" tick={{ fontSize: 9 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#f97316" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Bot Blocked by Country */}
          {chartData!.botTopCountries?.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>{t("topBlockedCountries")}</CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={botCountryConfig}>
                  <BarChart
                    data={chartData!.botTopCountries}
                    layout="vertical"
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis
                      type="category"
                      dataKey="country"
                      tick={{ fontSize: 10 }}
                      width={60}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
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
