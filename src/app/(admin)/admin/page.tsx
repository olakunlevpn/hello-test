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
} from "lucide-react";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

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

  useEffect(() => {
    fetch("/api/admin/stats")
      .then((r) => r.json())
      .then((data) => {
        setStats(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading || !stats) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

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
    </div>
  );
}
