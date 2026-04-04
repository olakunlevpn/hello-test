"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingText } from "@/components/ui/loading-text";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Download,
} from "lucide-react";
import { t } from "@/i18n";

interface AccountRow {
  id: string;
  email: string;
  displayName: string;
  status: string;
  tokenExpiresAt: string;
  lastRefreshedAt: string | null;
  webhookSubscriptionId: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

interface AccountsResponse {
  accounts: AccountRow[];
  total: number;
  page: number;
  totalPages: number;
}

type StatusFilter = "ALL" | "ACTIVE" | "NEEDS_REAUTH" | "REVOKED";

function statusIcon(status: string) {
  switch (status) {
    case "ACTIVE":
      return <ShieldCheck className="h-4 w-4 text-green-500" />;
    case "NEEDS_REAUTH":
      return <ShieldAlert className="h-4 w-4 text-red-500" />;
    default:
      return <ShieldOff className="h-4 w-4 text-muted-foreground" />;
  }
}

function statusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-600">{t("statusActive")}</Badge>;
    case "NEEDS_REAUTH":
      return <Badge variant="destructive">{t("statusNeedsReauth")}</Badge>;
    default:
      return <Badge variant="secondary">{t("statusRevoked")}</Badge>;
  }
}

function tokenHealthBadge(account: AccountRow) {
  if (account.status !== "ACTIVE") return null;
  const expiresIn = new Date(account.tokenExpiresAt).getTime() - Date.now();
  const minutes = Math.floor(expiresIn / 60000);
  if (minutes > 20)
    return <Badge variant="outline" className="text-green-500">{t("healthy")} ({minutes}m)</Badge>;
  if (minutes > 0)
    return <Badge variant="outline" className="text-yellow-500">{t("expiring")} ({minutes}m)</Badge>;
  return <Badge variant="outline" className="text-red-500">{t("expired")}</Badge>;
}

async function handleExport(accountId: string, email: string) {
  try {
    const res = await fetch(`/api/accounts/${accountId}/export`);
    if (!res.ok) return;
    const data = await res.json();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `token-${email.replace(/[@.]/g, "_")}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch { /* ignore */ }
}

export default function AdminAccountsPage() {
  const [data, setData] = useState<AccountsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const loadAccounts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    fetch(`/api/admin/accounts?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleTabChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("adminAccounts")}</h1>

      <Tabs value={statusFilter} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ALL">{t("viewAll")}</TabsTrigger>
          <TabsTrigger value="ACTIVE">{t("statusActive")}</TabsTrigger>
          <TabsTrigger value="NEEDS_REAUTH">{t("needsReauth")}</TabsTrigger>
          <TabsTrigger value="REVOKED">{t("statusRevoked")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {data ? t("totalOf", { count: String(data.total) }) : t("loading")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground"><LoadingText className="text-muted-foreground" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead></TableHead>
                    <TableHead>Microsoft {t("email")}</TableHead>
                    <TableHead>{t("owner")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("tokenHealth")}</TableHead>
                    <TableHead>{t("webhook")}</TableHead>
                    <TableHead>{t("lastSynced")}</TableHead>
                    <TableHead>{t("connectedOn")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.accounts.map((account) => (
                    <TableRow key={account.id}>
                      <TableCell>{statusIcon(account.status)}</TableCell>
                      <TableCell>
                        <div>
                          <p className="font-medium">{account.email}</p>
                          {account.displayName && (
                            <p className="text-xs text-muted-foreground">
                              {account.displayName}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/users/${account.user.id}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {account.user.email}
                        </Link>
                        {account.user.name && (
                          <p className="text-xs text-muted-foreground">{account.user.name}</p>
                        )}
                      </TableCell>
                      <TableCell>{statusBadge(account.status)}</TableCell>
                      <TableCell>{tokenHealthBadge(account)}</TableCell>
                      <TableCell>
                        {account.webhookSubscriptionId ? (
                          <Badge variant="outline" className="text-green-500">{t("active")}</Badge>
                        ) : (
                          <Badge variant="outline">{t("none")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {account.lastRefreshedAt
                          ? new Date(account.lastRefreshedAt).toLocaleString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(account.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {account.status === "ACTIVE" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => window.open(`/email/${account.id}`, "_blank")}
                            >
                              <ExternalLink className="mr-1 h-3 w-3" />
                              {t("viewEmail")}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleExport(account.id, account.email)}
                            title={t("exportToken")}
                          >
                            <Download className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.accounts || data.accounts.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {data && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("pageOf", { page: String(data.page), total: String(data.totalPages) })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
