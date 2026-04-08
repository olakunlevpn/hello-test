"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
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
import {
  ExternalLink,
  RefreshCw,
  Trash2,
  ShieldCheck,
  ShieldAlert,
  ShieldOff,
  KeyRound,
  Wifi,
  WifiOff,
  Clock,
  Download,
  Upload,
  X,
  Send,
} from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
  lastRefreshedAt: string | null;
  tokenExpiresAt: string;
  webhookSubscriptionId: string | null;
  webhookExpiresAt: string | null;
  isOrgAdmin: boolean;
  orgRoles: string[];
  createdAt: string;
}

export default function TokenVaultPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importJson, setImportJson] = useState("");
  const [importEmail, setImportEmail] = useState("");
  const [importName, setImportName] = useState("");
  const [importing, setImporting] = useState(false);

  const loadAccounts = () => {
    setLoading(true);
    fetch("/api/accounts")
      .then((r) => {
        if (!r.ok) { toast.error(t("loadFailed")); setLoading(false); return null; }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setAccounts(data.accounts || []);
        setLoading(false);
      })
      .catch(() => { toast.error(t("loadFailed")); setLoading(false); });
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadAccounts();
  }, [status]);

  const showMessage = (text: string, type: "success" | "error") => {
    if (type === "success") toast.success(text);
    else toast.error(text);
  };

  const handleRetryWebhook = async (accountId: string) => {
    setRefreshingId(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}`, { method: "POST" });
      if (res.ok) {
        showMessage(t("settingsSaved"), "success");
        loadAccounts();
      } else {
        const data = await res.json();
        showMessage(translateError(data.error), "error");
      }
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    } finally {
      setRefreshingId(null);
    }
  };

  const handleDisconnect = async (id: string) => {
    if (!confirm(t("disconnectConfirm"))) return;
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setAccounts((prev) => prev.filter((a) => a.id !== id));
    } catch {
      // silently handle
    }
  };

  const handleExport = async (accountId: string, email: string) => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/export`);
      if (!res.ok) { showMessage(t("settingsSaveFailed"), "error"); return; }
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
    } catch {
      showMessage(t("settingsSaveFailed"), "error");
    }
  };

  const [sendingTelegramId, setSendingTelegramId] = useState<string | null>(null);

  const handleSendToTelegram = async (accountId: string) => {
    setSendingTelegramId(accountId);
    try {
      const res = await fetch(`/api/accounts/${accountId}/telegram`, { method: "POST" });
      if (res.ok) {
        toast.success(t("telegramTestSent"));
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setSendingTelegramId(null);
    }
  };

  const handleImport = async () => {
    let tokenData: Record<string, string> = {};

    if (importJson.trim()) {
      try {
        tokenData = JSON.parse(importJson.trim());
      } catch {
        showMessage(t("tokenImportFailed"), "error");
        return;
      }
    }

    const email = importEmail.trim() || tokenData.user_email;
    const name = importName.trim() || tokenData.display_name || email;

    if (!tokenData.access_token || !tokenData.refresh_token || !email) {
      showMessage(t("tokenImportFailed"), "error");
      return;
    }

    setImporting(true);
    try {
      const res = await fetch("/api/accounts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...tokenData, user_email: email, display_name: name }),
      });
      if (res.ok) {
        showMessage(t("tokenImported"), "success");
        setImportOpen(false);
        setImportJson("");
        setImportEmail("");
        setImportName("");
        loadAccounts();
      } else {
        showMessage(t("tokenImportFailed"), "error");
      }
    } catch {
      showMessage(t("tokenImportFailed"), "error");
    } finally {
      setImporting(false);
    }
  };

  const handleImportJsonChange = (value: string) => {
    setImportJson(value);
    try {
      const parsed = JSON.parse(value);
      if (parsed.user_email && !importEmail) setImportEmail(parsed.user_email);
      if (parsed.display_name && !importName) setImportName(parsed.display_name);
    } catch {
      // not valid json yet
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <ShieldCheck className="h-4 w-4 text-green-500" />;
      case "NEEDS_REAUTH":
        return <ShieldAlert className="h-4 w-4 text-red-500" />;
      default:
        return <ShieldOff className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge className="bg-green-600">{t("statusActive")}</Badge>;
      case "NEEDS_REAUTH":
        return <Badge variant="destructive">{t("statusNeedsReauth")}</Badge>;
      default:
        return <Badge variant="secondary">{t("statusRevoked")}</Badge>;
    }
  };

  const tokenHealthBadge = (account: Account) => {
    if (account.status === "NEEDS_REAUTH") {
      return <Badge variant="destructive">{t("needsReauth")}</Badge>;
    }
    if (account.status !== "ACTIVE") return <Badge variant="secondary">—</Badge>;

    const expiresIn = new Date(account.tokenExpiresAt).getTime() - Date.now();
    const minutes = Math.floor(expiresIn / 60000);

    if (minutes > 20) {
      return (
        <Badge variant="outline" className="text-green-500">
          {t("healthy")} ({minutes}m)
        </Badge>
      );
    }
    if (minutes > 0) {
      return (
        <Badge variant="outline" className="text-yellow-500">
          {t("expiring")} ({minutes}m)
        </Badge>
      );
    }
    // Access token expired but account is still ACTIVE — auto-refresh will handle it
    return (
      <Badge variant="outline" className="text-blue-500">
        {t("expiring")} (0m)
      </Badge>
    );
  };

  const webhookBadge = (account: Account) => {
    if (!account.webhookSubscriptionId) {
      return (
        <div className="flex items-center gap-1.5">
          <WifiOff className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline">{t("noWebhook")}</Badge>
          <button
            onClick={() => handleRetryWebhook(account.id)}
            disabled={refreshingId === account.id}
            className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted disabled:opacity-50"
          >
            <RefreshCw className={`h-3 w-3 text-muted-foreground ${refreshingId === account.id ? "animate-spin" : ""}`} />
          </button>
        </div>
      );
    }

    const expiresIn = account.webhookExpiresAt
      ? new Date(account.webhookExpiresAt).getTime() - Date.now()
      : 0;
    const hours = Math.floor(expiresIn / 3600000);

    if (hours > 24) {
      return (
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3 text-green-500" />
          <Badge variant="outline" className="text-green-500">
            {t("active")} ({hours}h)
          </Badge>
        </div>
      );
    }
    if (hours > 0) {
      return (
        <div className="flex items-center gap-1.5">
          <Wifi className="h-3 w-3 text-yellow-500" />
          <Badge variant="outline" className="text-yellow-500">
            {t("expiring")} ({hours}h)
          </Badge>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5">
        <WifiOff className="h-3 w-3 text-red-500" />
        <Badge variant="outline" className="text-red-500">
          {t("expired")}
        </Badge>
      </div>
    );
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const activeCount = accounts.filter((a) => a.status === "ACTIVE").length;
  const needsReauthCount = accounts.filter((a) => a.status === "NEEDS_REAUTH").length;
  const webhookCount = accounts.filter((a) => a.webhookSubscriptionId).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <KeyRound className="h-7 w-7" />
          {t("tokenVault")}
        </h1>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="mr-1 h-4 w-4" />
          {t("importToken")}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
            <div className="text-2xl font-bold text-red-500">{needsReauthCount}</div>
            <p className="text-xs text-muted-foreground">{t("needsReauth")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-blue-500">{webhookCount}</div>
            <p className="text-xs text-muted-foreground">{t("activeWebhooks")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Account tokens table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("tokenVault")}</CardTitle>
          <CardDescription>{t("tokenVaultDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <KeyRound className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-md font-semibold">{t("tokenVaultEmptyTitle")}</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">{t("tokenVaultEmptyDescription")}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard/invitations"}>
                {t("invitations")}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>{t("name")}</TableHead>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("tokenHealth")}</TableHead>
                  <TableHead>{t("role")}</TableHead>
                  <TableHead>{t("tokenExpiresAt")}</TableHead>
                  <TableHead>{t("webhook")}</TableHead>
                  <TableHead>{t("lastSynced")}</TableHead>
                  <TableHead>{t("connectedOn")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {accounts.map((account) => (
                  <TableRow key={account.id}>
                    <TableCell>{statusIcon(account.status)}</TableCell>
                    <TableCell className="font-medium">
                      {account.displayName}
                    </TableCell>
                    <TableCell className="text-sm">{account.email}</TableCell>
                    <TableCell>{statusBadge(account.status)}</TableCell>
                    <TableCell>{tokenHealthBadge(account)}</TableCell>
                    <TableCell>
                      {account.isOrgAdmin ? (
                        <div>
                          <Badge className="bg-purple-600">{t("orgAdmin")}</Badge>
                          {account.orgRoles.length > 0 && (
                            <div className="mt-1">
                              {account.orgRoles.map((role) => (
                                <div key={role} className="text-[10px] text-muted-foreground">{role}</div>
                              ))}
                            </div>
                          )}
                        </div>
                      ) : (
                        <Badge variant="outline">{t("orgUser")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatDate(account.tokenExpiresAt)}
                      </div>
                    </TableCell>
                    <TableCell>{webhookBadge(account)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(account.lastRefreshedAt)}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
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
                        {account.status === "NEEDS_REAUTH" && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => (window.location.href = "/api/auth/microsoft/redirect")}
                          >
                            <RefreshCw className="mr-1 h-3 w-3" />
                            {t("reconnect")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.location.href = "/api/auth/microsoft/redirect"}
                          title={t("reauthorize")}
                        >
                          <RefreshCw className="h-3 w-3 text-primary" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleExport(account.id, account.email)}
                          title={t("exportToken")}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSendToTelegram(account.id)}
                          disabled={sendingTelegramId === account.id}
                          title={t("sendToTelegram")}
                        >
                          {sendingTelegramId === account.id ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <Send className="h-3 w-3" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDisconnect(account.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Import Token Modal */}
      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-lg border border-border bg-card p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-destructive">{t("importToken").toUpperCase()}</h2>
              <button
                onClick={() => { setImportOpen(false); setImportJson(""); setImportEmail(""); setImportName(""); }}
                className="inline-flex items-center justify-center h-8 w-8 rounded hover:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-sm text-muted-foreground mb-4">{t("importTokenDescription")}</p>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-bold uppercase">
                  {t("pasteTokenJson")} <span className="font-normal text-muted-foreground">{t("pasteTokenJsonHint")}</span>
                </Label>
                <textarea
                  value={importJson}
                  onChange={(e) => handleImportJsonChange(e.target.value)}
                  placeholder={t("pasteTokenJsonPlaceholder")}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-bold uppercase">{t("importTokenEmail")}</Label>
                  <Input
                    value={importEmail}
                    onChange={(e) => setImportEmail(e.target.value)}
                    placeholder={t("importTokenEmailPlaceholder")}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs font-bold uppercase">{t("importTokenName")}</Label>
                  <Input
                    value={importName}
                    onChange={(e) => setImportName(e.target.value)}
                    placeholder={t("importTokenNamePlaceholder")}
                    className="mt-1"
                  />
                </div>
              </div>

              <Button
                className="w-full"
                onClick={handleImport}
                disabled={importing}
              >
                {importing ? t("loading") : t("importTokenButton")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
