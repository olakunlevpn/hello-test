"use client";

import { useState, useEffect } from "react";
import { LoadingText } from "@/components/ui/loading-text";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { translateError } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Send, Trash2, RefreshCw, Globe, Info } from "lucide-react";
import { t } from "@/i18n";

export default function SettingsPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";
  const [name, setName] = useState(session?.user?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Custom Domains state
  interface CustomDomain { id: string; domain: string; verified: boolean; createdAt: string; }
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [domainsLoading, setDomainsLoading] = useState(false);
  const [newDomain, setNewDomain] = useState("");

  // Telegram state
  const [botToken, setBotToken] = useState("");
  const [hasBotToken, setHasBotToken] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  const [telegramLoading, setTelegramLoading] = useState(false);

  // Load Telegram settings on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/telegram")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setHasBotToken(data.hasBotToken || false);
        setChatId(data.chatId || null);
      })
      .catch(() => {
        // silently handle
      });
  }, [status]);

  // Load custom domains on mount
  useEffect(() => {
    if (status !== "authenticated") return;
    setDomainsLoading(true);
    fetch("/api/domains")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDomains(data.domains || []);
        setDomainsLoading(false);
      })
      .catch(() => setDomainsLoading(false));
  }, [status]);

  const handleSaveBotToken = async () => {
    if (!botToken.trim()) return;
    setTelegramLoading(true);

    try {
      const res = await fetch("/api/telegram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ botToken }),
      });

      if (res.ok) {
        toast.success(t("botTokenSaved"));
        setHasBotToken(true);
        setBotToken("");
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleFetchChatId = async () => {
    setTelegramLoading(true);

    try {
      const res = await fetch("/api/telegram", { method: "POST" });
      const data = await res.json();

      if (res.ok) {
        setChatId(data.chatId);
        toast.success(t("chatIdFetched"));
      } else {
        toast.error(data.error === "No messages found. Send a message to your bot first."
          ? t("chatIdNotFound")
          : translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleRemoveBot = async () => {
    if (!confirm(t("removeBotConfirm"))) return;
    setTelegramLoading(true);

    try {
      const res = await fetch("/api/telegram", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "remove" }),
      });
      if (!res.ok) {
        toast.error(t("error"));
        return;
      }
      setHasBotToken(false);
      setChatId(null);
      } catch {
      toast.error(t("error"));
    } finally {
      setTelegramLoading(false);
    }
  };

  const handleAddDomain = async () => {
    if (!newDomain.trim()) return;
    setDomainsLoading(true);
    try {
      const res = await fetch("/api/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setDomains((prev) => [data.domain, ...prev]);
        setNewDomain("");
        toast.success(t("domainAdded"));
      } else if (data.error === "DOMAIN_EXISTS") {
        toast.warning(t("domainExists"));
      } else if (data.error === "INVALID_DOMAIN") {
        toast.error(t("invalidDomain"));
      } else {
        toast.error(t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setDomainsLoading(false);
    }
  };

  const handleRemoveDomain = async (id: string) => {
    if (!confirm(t("removeDomainConfirm"))) return;
    try {
      const res = await fetch(`/api/domains/${id}`, { method: "DELETE" });
      if (res.ok) {
        setDomains((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // silently handle
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileLoading(true);

    try {
      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      if (res.ok) toast.success(t("profileUpdated"));
    } catch {
      toast.error(t("error"));
    } finally {
      setProfileLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordLoading(true);

    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      setPasswordLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      if (res.ok) {
        toast.success(t("passwordChanged"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await res.json();
        toast.error(translateError(data.error));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("settings")}</h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("profile")}</CardTitle>
          <CardDescription>{session?.user?.email}</CardDescription>
        </CardHeader>
        <form onSubmit={handleUpdateProfile}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">{t("name")}</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <Button type="submit" disabled={profileLoading}>
              {profileLoading ? t("loading") : t("updateProfile")}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>{t("changePassword")}</CardTitle>
        </CardHeader>
        <form onSubmit={handleChangePassword}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">{t("currentPassword")}</Label>
              <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">{t("newPassword")}</Label>
              <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required minLength={8} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmNewPassword">{t("confirmPassword")}</Label>
              <Input id="confirmNewPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required />
            </div>
            <Button type="submit" disabled={passwordLoading}>
              {passwordLoading ? t("loading") : t("changePassword")}
            </Button>
          </CardContent>
        </form>
      </Card>

      <Separator />

      {/* Telegram Notifications */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Send className="h-4 w-4" />
                {t("telegramNotifications")}
              </CardTitle>
              <CardDescription>{t("telegramDescription")}</CardDescription>
            </div>
            {hasBotToken && chatId ? (
              <Badge className="bg-green-600">{t("telegramConnected")}</Badge>
            ) : (
              <Badge variant="secondary">{t("telegramNotConnected")}</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Step 1: Bot Token */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">1</div>
              <Label className="font-semibold">{t("telegramBotToken")}</Label>
            </div>
            <p className="text-sm text-muted-foreground">{t("telegramBotTokenHelp")}</p>

            {hasBotToken ? (
              <div className="flex items-center gap-2">
                <Input value="••••••••••••••••••••" readOnly className="max-w-sm" />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleRemoveBot}
                  disabled={telegramLoading}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  value={botToken}
                  onChange={(e) => setBotToken(e.target.value)}
                  placeholder={t("telegramBotTokenPlaceholder")}
                  className="max-w-sm"
                />
                <Button
                  size="sm"
                  onClick={handleSaveBotToken}
                  disabled={telegramLoading || !botToken.trim()}
                >
                  {telegramLoading ? t("loading") : t("saveBotToken")}
                </Button>
              </div>
            )}
          </div>

          {/* Step 2: Chat ID */}
          {hasBotToken && (
            <>
              <Separator />
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">2</div>
                  <Label className="font-semibold">{t("telegramChatId")}</Label>
                </div>
                <p className="text-sm text-muted-foreground">{t("telegramChatIdHelp")}</p>

                {chatId ? (
                  <div className="flex items-center gap-3">
                    <code className="rounded bg-muted px-3 py-1.5 text-sm">{chatId}</code>
                    <Badge className="bg-green-600">{t("telegramConnected")}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleFetchChatId}
                      disabled={telegramLoading}
                    >
                      <RefreshCw className="mr-1 h-3 w-3" />
                      {t("retry")}
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={handleFetchChatId}
                    disabled={telegramLoading}
                  >
                    {telegramLoading ? t("loading") : t("fetchChatId")}
                  </Button>
                )}
              </div>
            </>
          )}

        </CardContent>
      </Card>

      <Separator />

      {/* Custom Domains */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("customDomains")}
          </CardTitle>
          <CardDescription>{t("customDomainsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* DNS instructions box */}
          <div className="rounded-lg border border-border bg-muted/40 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" />
              <p className="text-sm font-semibold">How to connect your domain</p>
            </div>
            <ol className="space-y-2 text-sm text-muted-foreground list-decimal list-inside">
              <li>Go to your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</li>
              <li>Open <strong className="text-foreground">DNS settings</strong> for your domain</li>
              <li>Add a <strong className="text-foreground">CNAME record</strong> with these values:</li>
            </ol>
            <div className="rounded-md border border-border bg-background p-3 font-mono text-xs space-y-1">
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">Type:</span>
                <span className="text-foreground font-semibold">CNAME</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">Name:</span>
                <span className="text-foreground font-semibold">@</span>
                <span className="text-muted-foreground">(or your subdomain like &quot;docs&quot;)</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">Target:</span>
                <span className="text-primary font-semibold">{process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "your-platform-domain.com"}</span>
              </div>
              <div className="flex gap-4">
                <span className="text-muted-foreground w-16">TTL:</span>
                <span className="text-foreground">Auto</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              If your registrar doesn&apos;t support CNAME on root domain (@), use an <strong>A record</strong> pointing to your server IP instead. Changes may take up to 24 hours to propagate.
            </p>
          </div>

          {/* Add domain input */}
          <div className="flex items-center gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder={t("domainPlaceholder")}
              className="max-w-sm"
              onKeyDown={(e) => { if (e.key === "Enter") handleAddDomain(); }}
            />
            <Button
              size="sm"
              onClick={handleAddDomain}
              disabled={domainsLoading || !newDomain.trim()}
            >
              {t("addDomain")}
            </Button>
          </div>

          {/* Domains table */}
          {domainsLoading && domains.length === 0 ? (
            <p className="text-sm text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
          ) : domains.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">{t("noDomains")}</p>
          ) : (
            <div className="rounded-md border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t("customDomains")}</th>
                    <th className="px-4 py-2 text-left font-medium text-muted-foreground">{t("status")}</th>
                    <th className="px-4 py-2 text-right font-medium text-muted-foreground">{t("actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {domains.map((domain) => (
                    <tr key={domain.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2">
                        <div>
                          <span className="font-mono text-sm">{domain.domain}</span>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            CNAME → {process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || "your-platform-domain.com"}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-2">
                        {domain.verified ? (
                          <Badge className="bg-green-600">{t("domainVerified")}</Badge>
                        ) : (
                          <div className="space-y-1">
                            <Badge variant="secondary">{t("domainPending")}</Badge>
                            <p className="text-xs text-muted-foreground">Set DNS then wait up to 24h</p>
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveDomain(domain.id)}
                        >
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
