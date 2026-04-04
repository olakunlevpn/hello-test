"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingText } from "@/components/ui/loading-text";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/i18n";

interface UserRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  _count: { linkedAccounts: number; payments: number };
  linkedAccounts: { status: string }[];
  subscription: { status: string } | null;
}

interface UsersResponse {
  users: UserRow[];
  total: number;
  page: number;
  totalPages: number;
}

function roleBadge(role: string) {
  if (role === "ADMIN") return <Badge variant="destructive">ADMIN</Badge>;
  return <Badge variant="outline">USER</Badge>;
}

function userStatusBadge(status: string) {
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-600">{t("userActive")}</Badge>;
    case "SUSPENDED":
      return <Badge variant="outline" className="text-yellow-500 border-yellow-500">{t("userSuspended")}</Badge>;
    case "BLOCKED":
      return <Badge variant="destructive">{t("userBlocked")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

function subscriptionBadge(status: string | null) {
  if (!status) return <Badge variant="secondary">{t("noSubscription")}</Badge>;
  switch (status) {
    case "ACTIVE":
      return <Badge className="bg-green-600">{t("activeSubscription")}</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">{t("expired")}</Badge>;
    case "CANCELLED":
      return <Badge variant="outline">{t("cancelled")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");

  const loadUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (search) params.set("search", search);
    fetch(`/api/admin/users?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const handleImpersonate = async (userId: string) => {
    const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      if (data.token) {
        document.cookie = `next-auth.session-token=${data.token}; path=/; max-age=3600`;
        window.open("/dashboard", "_blank");
      }
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(t("deleteUserConfirm"))) return;
    const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
    if (res.ok) {
      loadUsers();
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("adminUsers")}</h1>

      <form onSubmit={handleSearch} className="flex gap-2">
        <Input
          placeholder={t("search")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="max-w-sm"
        />
        <Button type="submit">{t("search")}</Button>
        {search && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              setSearch("");
              setSearchInput("");
              setPage(1);
            }}
          >
            {t("cancel")}
          </Button>
        )}
      </form>

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
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("role")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("accounts")}</TableHead>
                    <TableHead>{t("subscription")}</TableHead>
                    <TableHead>{t("activeAccounts")} / {t("failingTokens")}</TableHead>
                    <TableHead>{t("joined")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.users.map((user) => {
                    const activeTokens = user.linkedAccounts.filter(
                      (a) => a.status === "ACTIVE"
                    ).length;
                    const failingTokens = user.linkedAccounts.filter(
                      (a) => a.status === "NEEDS_REAUTH"
                    ).length;

                    return (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.email}</TableCell>
                        <TableCell>{user.name ?? "—"}</TableCell>
                        <TableCell>{roleBadge(user.role)}</TableCell>
                        <TableCell>{userStatusBadge(user.status)}</TableCell>
                        <TableCell>{user._count.linkedAccounts}</TableCell>
                        <TableCell>
                          {subscriptionBadge(user.subscription?.status ?? null)}
                        </TableCell>
                        <TableCell className="text-sm">
                          <span className="text-green-500">{activeTokens}</span>
                          {" / "}
                          <span className="text-red-500">{failingTokens}</span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(user.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger render={
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            }>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem
                                onClick={() => router.push(`/admin/users/${user.id}`)}
                              >
                                {t("viewUserDetail")}
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => handleImpersonate(user.id)}>
                                {t("impersonate")}
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={() => handleDelete(user.id)}
                              >
                                {t("deleteUser")}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!data?.users || data.users.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={8}
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
