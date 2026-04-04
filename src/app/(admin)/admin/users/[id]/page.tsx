"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingText } from "@/components/ui/loading-text";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  Ban,
  Lock,
  Unlock,
  KeyRound,
} from "lucide-react";
import { t } from "@/i18n";

interface LinkedAccount {
  id: string;
  email: string;
  displayName: string;
  status: string;
  tokenExpiresAt: string;
  lastRefreshedAt: string | null;
  webhookSubscriptionId: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  plan: string;
  amountUSD: number;
  amountBTC: number;
  bitcoinAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
}

interface Subscription {
  id: string;
  plan: string;
  status: string;
  currentPeriodEnd: string;
}

interface UserDetail {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
  subscription: Subscription | null;
  linkedAccounts: LinkedAccount[];
  payments: Payment[];
}

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

function tokenHealthBadge(account: LinkedAccount) {
  if (account.status !== "ACTIVE") return null;
  const expiresIn = new Date(account.tokenExpiresAt).getTime() - Date.now();
  const minutes = Math.floor(expiresIn / 60000);
  if (minutes > 20)
    return <Badge variant="outline" className="text-green-500">{t("healthy")} ({minutes}m)</Badge>;
  if (minutes > 0)
    return <Badge variant="outline" className="text-yellow-500">{t("expiring")} ({minutes}m)</Badge>;
  return <Badge variant="outline" className="text-red-500">{t("expired")}</Badge>;
}

function paymentStatusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return <Badge className="bg-green-600">{t("paymentConfirmed")}</Badge>;
    case "PENDING":
      return <Badge variant="outline" className="text-yellow-500">{t("paymentPending")}</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">{t("paymentExpired")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<UserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Edit user details
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [detailsMsg, setDetailsMsg] = useState("");
  const [passwordMsg, setPasswordMsg] = useState("");

  const loadUser = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/users/${userId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (!d) { setLoading(false); return; }
        setUser(d.user);
        if (d.user) {
          setEditName(d.user.name || "");
          setEditEmail(d.user.email || "");
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const patchUser = async (body: Record<string, unknown>) => {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) await loadUser();
    } catch {
      // silently handle
    }
    setActionLoading(false);
  };

  const handleImpersonate = async () => {
    try {
      const res = await fetch(`/api/admin/users/${userId}/impersonate`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          document.cookie = `next-auth.session-token=${data.token}; path=/; max-age=3600`;
          window.open("/dashboard", "_blank");
        }
      }
    } catch {
      // silently handle network errors
    }
  };

  const handleToggleRole = () => {
    if (!user) return;
    patchUser({ role: user.role === "ADMIN" ? "USER" : "ADMIN" });
  };

  const handleStatusChange = (newStatus: "ACTIVE" | "SUSPENDED" | "BLOCKED") => {
    const confirmMsg =
      newStatus === "SUSPENDED" ? t("suspendUserConfirm") :
      newStatus === "BLOCKED" ? t("blockUserConfirm") :
      t("activateUserConfirm");
    if (!confirm(confirmMsg)) return;
    patchUser({ status: newStatus });
  };

  const handleUpdateDetails = async () => {
    setDetailsMsg("");
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, email: editEmail }),
      });
      if (res.ok) {
        setDetailsMsg(t("userDetailsUpdated"));
        await loadUser();
      } else {
        try {
          const data = await res.json();
          setDetailsMsg(data.error || t("error"));
        } catch {
          setDetailsMsg(t("error"));
        }
      }
    } catch {
      setDetailsMsg(t("error"));
    }
    setActionLoading(false);
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 8) {
      setPasswordMsg("Password must be at least 8 characters");
      return;
    }
    if (!confirm(t("resetPasswordConfirm"))) return;
    setPasswordMsg("");
    setActionLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (res.ok) {
        setPasswordMsg(t("passwordResetSuccess"));
        setNewPassword("");
      } else {
        try {
          const data = await res.json();
          setPasswordMsg(data.error || t("error"));
        } catch {
          setPasswordMsg(t("error"));
        }
      }
    } catch {
      setPasswordMsg(t("error"));
    }
    setActionLoading(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">{t("noResults")}</p>
      </div>
    );
  }

  const sub = user.subscription;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          {t("back")}
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{user.email}</h1>
            {user.role === "ADMIN" ? (
              <Badge variant="destructive">ADMIN</Badge>
            ) : (
              <Badge variant="outline">USER</Badge>
            )}
            {user.status === "SUSPENDED" && (
              <Badge variant="outline" className="text-yellow-500 border-yellow-500">{t("userSuspended")}</Badge>
            )}
            {user.status === "BLOCKED" && (
              <Badge variant="destructive">{t("userBlocked")}</Badge>
            )}
            {user.status === "ACTIVE" && (
              <Badge className="bg-green-600">{t("userActive")}</Badge>
            )}
          </div>
          {user.name && <p className="text-muted-foreground">{user.name}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={actionLoading}
            onClick={handleToggleRole}
          >
            {user.role === "ADMIN" ? t("makeUser") : t("makeAdmin")}
          </Button>
          {user.status === "ACTIVE" && (
            <>
              <Button
                variant="outline"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleStatusChange("SUSPENDED")}
              >
                <Lock className="mr-1 h-3 w-3" />
                {t("suspendUser")}
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={actionLoading}
                onClick={() => handleStatusChange("BLOCKED")}
              >
                <Ban className="mr-1 h-3 w-3" />
                {t("blockUser")}
              </Button>
            </>
          )}
          {(user.status === "SUSPENDED" || user.status === "BLOCKED") && (
            <Button
              variant="default"
              size="sm"
              disabled={actionLoading}
              onClick={() => handleStatusChange("ACTIVE")}
            >
              <Unlock className="mr-1 h-3 w-3" />
              {t("activateUser")}
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            disabled={actionLoading}
            onClick={handleImpersonate}
          >
            {t("impersonate")}
          </Button>
        </div>
      </div>

      {/* Edit User Details */}
      <Card>
        <CardHeader>
          <CardTitle>{t("editUserDetails")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="editName">{t("name")}</Label>
              <Input
                id="editName"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">{t("email")}</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
          </div>
          {detailsMsg && (
            <p className={`text-sm ${detailsMsg.includes("updated") ? "text-green-500" : "text-destructive"}`}>
              {detailsMsg}
            </p>
          )}
          <Button
            size="sm"
            disabled={actionLoading}
            onClick={handleUpdateDetails}
          >
            {t("updateUserDetails")}
          </Button>
        </CardContent>
      </Card>

      {/* Reset Password */}
      <Card>
        <CardHeader>
          <CardTitle>
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4" />
              {t("resetPassword")}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-2">
            <Label htmlFor="newPassword">{t("newPassword")}</Label>
            <Input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
            />
          </div>
          {passwordMsg && (
            <p className={`text-sm ${passwordMsg.includes("reset") ? "text-green-500" : "text-destructive"}`}>
              {passwordMsg}
            </p>
          )}
          <Button
            size="sm"
            variant="outline"
            disabled={actionLoading || !newPassword}
            onClick={handleResetPassword}
          >
            <KeyRound className="mr-1 h-3 w-3" />
            {t("resetPassword")}
          </Button>
        </CardContent>
      </Card>

      <Separator />

      {/* Subscription Card */}
      <Card>
        <CardHeader>
          <CardTitle>{t("userSubscription")}</CardTitle>
          <CardDescription>
            {sub ? `${sub.plan} — ${sub.status}` : t("noSubscription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {sub && (
            <div className="flex items-center gap-4 text-sm">
              <span className="text-muted-foreground">{t("subscriptionExpires")}:</span>
              <span>{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
            </div>
          )}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading}
              onClick={() => patchUser({ subscriptionAction: "extend", extendDays: 30 })}
            >
              +30 Days
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={actionLoading}
              onClick={() => patchUser({ subscriptionAction: "extend", extendDays: 365 })}
            >
              +1 Year
            </Button>
            {sub ? (
              <Button
                size="sm"
                variant="destructive"
                disabled={actionLoading}
                onClick={() => {
                  if (confirm(t("revokeSubscription") + "?"))
                    patchUser({ subscriptionAction: "revoke" });
                }}
              >
                {t("revokeSubscription")}
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={actionLoading}
                onClick={() => patchUser({ subscriptionAction: "extend", extendDays: 30 })}
              >
                {t("manuallyExtend")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      <Card>
        <CardHeader>
          <CardTitle>{t("userAccounts")}</CardTitle>
          <CardDescription>{user.linkedAccounts.length} connected</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead></TableHead>
                <TableHead>{t("email")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("tokenHealth")}</TableHead>
                <TableHead>{t("webhook")}</TableHead>
                <TableHead>{t("lastSynced")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.linkedAccounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell>{statusIcon(account.status)}</TableCell>
                  <TableCell>
                    <div>
                      <p className="font-medium">{account.email}</p>
                      {account.displayName && (
                        <p className="text-xs text-muted-foreground">{account.displayName}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {account.status === "ACTIVE" ? (
                      <Badge className="bg-green-600">{t("statusActive")}</Badge>
                    ) : account.status === "NEEDS_REAUTH" ? (
                      <Badge variant="destructive">{t("statusNeedsReauth")}</Badge>
                    ) : (
                      <Badge variant="secondary">{t("statusRevoked")}</Badge>
                    )}
                  </TableCell>
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
                </TableRow>
              ))}
              {user.linkedAccounts.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    {t("noResults")}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader>
          <CardTitle>{t("userPayments")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("date")}</TableHead>
                <TableHead>{t("plan")}</TableHead>
                <TableHead>{t("amountUSD")}</TableHead>
                <TableHead>{t("amountBTC")}</TableHead>
                <TableHead>{t("status")}</TableHead>
                <TableHead>{t("txHash")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {user.payments.map((payment) => (
                <TableRow key={payment.id}>
                  <TableCell className="text-sm">
                    {new Date(payment.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>{payment.plan}</TableCell>
                  <TableCell>${Number(payment.amountUSD).toFixed(2)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {Number(payment.amountBTC).toFixed(8)}
                  </TableCell>
                  <TableCell>{paymentStatusBadge(payment.status)}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {payment.txHash
                      ? `${payment.txHash.slice(0, 8)}...${payment.txHash.slice(-8)}`
                      : "—"}
                  </TableCell>
                </TableRow>
              ))}
              {user.payments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                    {t("noPayments")}
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
