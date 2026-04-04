"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  Building2,
  Mail,
  Users,
  RefreshCw,
  Search,
  X,
  Copy,
  UserPlus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
  isOrgAdmin: boolean;
  orgRoles: string[];
}

interface OrgUser {
  id: string;
  displayName: string;
  mail: string;
  userPrincipalName: string;
  jobTitle?: string;
  department?: string;
  accountEnabled?: boolean;
}

export default function OrgAccessPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  // Org users panel
  const [activeAccountId, setActiveAccountId] = useState<string | null>(null);
  const [activeAccountEmail, setActiveAccountEmail] = useState("");
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [orgUsersLoading, setOrgUsersLoading] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  // Actions panel
  const [actionUser, setActionUser] = useState<OrgUser | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [forceChange, setForceChange] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);
  const [toggling, setToggling] = useState(false);

  // Create user
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createNickname, setCreateNickname] = useState("");
  const [createUpn, setCreateUpn] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const adminAccounts = accounts.filter((a) => a.isOrgAdmin);

  const loadOrgUsers = useCallback(async (accountId: string) => {
    setOrgUsersLoading(true);
    setOrgUsers([]);
    setActionUser(null);
    setShowCreateUser(false);
    try {
      const res = await fetch(`/api/org-users?accountId=${accountId}`);
      if (res.ok) {
        const data = await res.json();
        setOrgUsers(data.value || []);
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setOrgUsersLoading(false);
    }
  }, []);

  const handleOpenOrgUsers = (account: Account) => {
    setActiveAccountId(account.id);
    setActiveAccountEmail(account.email);
    setUserSearch("");
    loadOrgUsers(account.id);
  };

  const handleCloseOrgUsers = () => {
    setActiveAccountId(null);
    setOrgUsers([]);
    setActionUser(null);
    setShowCreateUser(false);
  };

  const handleRescanAll = () => {
    setAccounts([]);
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  const handleResetPassword = async () => {
    if (!activeAccountId || !actionUser || !newPassword) return;
    setResetting(true);
    setResetResult(null);
    try {
      const res = await fetch(`/api/org-users/${actionUser.id}/password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId, newPassword, forceChange }),
      });
      if (res.ok) {
        setResetResult(newPassword);
        toast.success(t("orgPasswordReset"));
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setResetting(false);
    }
  };

  const handleToggleAccount = async () => {
    if (!activeAccountId || !actionUser) return;
    const newEnabled = !actionUser.accountEnabled;
    setToggling(true);
    try {
      const res = await fetch(`/api/org-users/${actionUser.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: activeAccountId, enabled: newEnabled }),
      });
      if (res.ok) {
        toast.success(t("orgAccountUpdated"));
        setActionUser({ ...actionUser, accountEnabled: newEnabled });
        setOrgUsers((prev) => prev.map((u) => u.id === actionUser.id ? { ...u, accountEnabled: newEnabled } : u));
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setToggling(false);
    }
  };

  const handleCreateUser = async () => {
    if (!activeAccountId || !createName || !createUpn || !createPassword) return;
    setCreating(true);
    try {
      const res = await fetch("/api/org-users/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId: activeAccountId,
          displayName: createName,
          mailNickname: createNickname || createName.replace(/\s+/g, "").toLowerCase(),
          userPrincipalName: createUpn,
          password: createPassword,
        }),
      });
      if (res.ok) {
        toast.success(t("orgUserCreated"));
        setShowCreateUser(false);
        setCreateName("");
        setCreateNickname("");
        setCreateUpn("");
        setCreatePassword("");
        loadOrgUsers(activeAccountId);
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setCreating(false);
    }
  };

  const filteredUsers = userSearch.trim()
    ? orgUsers.filter((u) => {
        const q = userSearch.toLowerCase();
        return (
          u.displayName?.toLowerCase().includes(q) ||
          u.mail?.toLowerCase().includes(q) ||
          u.userPrincipalName?.toLowerCase().includes(q)
        );
      })
    : orgUsers;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Building2 className="h-7 w-7" />
          {t("orgAccess")}
        </h1>
        <Button variant="destructive" size="sm" onClick={handleRescanAll}>
          <RefreshCw className="mr-1 h-3 w-3" />
          {t("orgRescanAll")}
        </Button>
      </div>

      {/* Admin Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("orgAccess")}</CardTitle>
          <CardDescription>{t("orgAccessDescription")}</CardDescription>
          {adminAccounts.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1">
              {t("orgAdminCaptures", { count: String(adminAccounts.length) })}
            </p>
          )}
        </CardHeader>
        <CardContent>
          {adminAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center max-w-sm">{t("orgNoAdminAccounts")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("orgRoles")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {adminAccounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell className="text-sm">{account.email}</TableCell>
                    <TableCell className="text-sm">{account.displayName}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(account.orgRoles || []).map((r) => (
                          <Badge key={r} className="bg-green-700 text-[10px]">{r.toUpperCase()}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleOpenOrgUsers(account)}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Users className="mr-1 h-3 w-3" />
                        {t("orgUsers")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Org Users Panel */}
      {activeAccountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary">
                {t("orgOrgUsersOf", { email: activeAccountEmail.toUpperCase() })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={handleCloseOrgUsers}>
                {t("orgClosePanel")}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Search + All + Create */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Input
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search by name or email..."
                className="max-w-xs"
              />
              <Button onClick={() => loadOrgUsers(activeAccountId)}>
                <Search className="mr-1 h-3 w-3" />
                {t("search")}
              </Button>
              <Button variant="secondary" onClick={() => setUserSearch("")}>
                {t("filterAll")}
              </Button>
              <Button className="bg-green-600 hover:bg-green-700" onClick={() => setShowCreateUser(!showCreateUser)}>
                <UserPlus className="mr-1 h-3 w-3" />
                {t("orgCreateUser")}
              </Button>
            </div>

            {/* Create User Form */}
            {showCreateUser && (
              <div className="border border-border rounded-md p-4 mb-4 space-y-3">
                <h3 className="text-sm font-semibold">{t("orgCreateUserTitle")}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">{t("orgDisplayName")}</Label>
                    <Input value={createName} onChange={(e) => setCreateName(e.target.value)} placeholder="John Doe" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("orgMailNickname")}</Label>
                    <Input value={createNickname} onChange={(e) => setCreateNickname(e.target.value)} placeholder="johndoe" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("orgUserPrincipalName")}</Label>
                    <Input value={createUpn} onChange={(e) => setCreateUpn(e.target.value)} placeholder="john@company.onmicrosoft.com" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("orgPassword")}</Label>
                    <Input value={createPassword} onChange={(e) => setCreatePassword(e.target.value)} placeholder="StrongPass@1" />
                  </div>
                </div>
                <Button onClick={handleCreateUser} disabled={creating || !createName || !createUpn || !createPassword}>
                  {creating ? t("loading") : t("orgCreateUser")}
                </Button>
              </div>
            )}

            {/* Users Table */}
            {orgUsersLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingText className="text-muted-foreground" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("orgNoUsers")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("name")}</TableHead>
                    <TableHead>{t("email")}</TableHead>
                    <TableHead>{t("orgUserTitle")}</TableHead>
                    <TableHead>{t("orgDepartment")}</TableHead>
                    <TableHead>{t("orgStatus")}</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium text-sm">{user.displayName || "—"}</TableCell>
                      <TableCell className="text-sm">{user.mail || user.userPrincipalName}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.jobTitle || ""}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{user.department || ""}</TableCell>
                      <TableCell>
                        <Badge className={user.accountEnabled !== false ? "bg-green-600" : "bg-destructive"}>
                          {user.accountEnabled !== false ? t("orgActive") : t("orgDisabled")}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => { setActionUser(user); setResetResult(null); setNewPassword(""); }}
                        >
                          {t("orgActions")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}

      {/* Actions Panel */}
      {actionUser && activeAccountId && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-primary">
                {t("orgActions")} — {actionUser.displayName.toUpperCase()}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setActionUser(null)}>
                {t("orgClosePanel")}
              </Button>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge className={actionUser.accountEnabled !== false ? "bg-green-600" : "bg-destructive"}>
                {actionUser.accountEnabled !== false ? t("orgActive") : t("orgDisabled")}
              </Badge>
              <span className="text-xs text-muted-foreground font-mono">{actionUser.id}</span>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Reset Password */}
              <div className="border border-border rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold text-destructive">{t("orgResetPassword")}</h3>
                <Input
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="NewPassword@1"
                />
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    checked={forceChange}
                    onChange={(e) => setForceChange(e.target.checked)}
                    className="accent-primary"
                  />
                  {t("orgForceChange")}
                </label>
                <Button variant="destructive" className="w-full" onClick={handleResetPassword} disabled={resetting || !newPassword}>
                  {resetting ? t("loading") : t("orgResetPassword")}
                </Button>

                {resetResult && (
                  <div className="border border-border rounded-md p-3 mt-2">
                    <p className="text-xs text-muted-foreground">{t("orgNewPasswordHint")}</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(resetResult); toast.success(t("copied")); }}
                      className="text-primary font-bold text-lg mt-1 hover:underline cursor-pointer"
                    >
                      {resetResult}
                    </button>
                    <p className="text-xs text-muted-foreground mt-2">{t("orgLoginHint")}</p>
                  </div>
                )}
              </div>

              {/* Account Control */}
              <div className="border border-border rounded-md p-4 space-y-3">
                <h3 className="text-sm font-semibold">{t("orgAccountControl")}</h3>
                <p className="text-sm">
                  {actionUser.accountEnabled !== false ? (
                    <>{t("orgAccountEnabled").replace("enabled", "")} <span className="text-green-500 font-semibold">enabled</span>.</>
                  ) : (
                    <>{t("orgAccountDisabled").replace("disabled", "")} <span className="text-destructive font-semibold">disabled</span>.</>
                  )}
                </p>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={handleToggleAccount}
                  disabled={toggling}
                >
                  {toggling
                    ? t("loading")
                    : actionUser.accountEnabled !== false
                      ? t("orgDisableAccount")
                      : t("orgEnableAccount")}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
