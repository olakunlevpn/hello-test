"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Link2,
  Copy,
  Check,
  Trash2,
  Pause,
  Play,
  KeyRound,
  Loader2,
  Eye,
} from "lucide-react";
import { t } from "@/i18n";
import { toast } from "sonner";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
}

interface SharedLink {
  id: string;
  code: string;
  label: string | null;
  status: string;
  expiresAt: string | null;
  viewCount: number;
  lastViewedAt: string | null;
  createdAt: string;
  linkedAccount: { email: string; displayName: string };
}

const EXPIRY_OPTIONS = [
  { value: "0", labelKey: "linkNoExpiry" as const },
  { value: "1", labelKey: "link1Hour" as const },
  { value: "6", labelKey: "link6Hours" as const },
  { value: "24", labelKey: "link24Hours" as const },
  { value: "168", labelKey: "link7Days" as const },
  { value: "720", labelKey: "link30Days" as const },
];

export default function ViewerLinksPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<SharedLink[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create form
  const [selectedAccount, setSelectedAccount] = useState("");
  const [password, setPassword] = useState("");
  const [label, setLabel] = useState("");
  const [expiryHours, setExpiryHours] = useState("0");

  // Reset password dialog
  const [resetDialogId, setResetDialogId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    Promise.all([
      fetch("/api/viewer-links").then((r) => r.ok ? r.json() : null),
      fetch("/api/accounts").then((r) => r.ok ? r.json() : null),
    ]).then(([linksData, accountsData]) => {
      if (linksData) setLinks(linksData.links || []);
      if (accountsData) setAccounts(accountsData.accounts || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [status]);

  const handleCreate = async () => {
    if (!selectedAccount || !password || password.length < 4) return;
    setCreating(true);
    try {
      const res = await fetch("/api/viewer-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedAccountId: selectedAccount,
          password,
          label,
          expiryHours: expiryHours === "0" ? null : parseInt(expiryHours, 10),
        }),
      });
      if (res.ok) {
        toast.success(t("linkCreated"));
        setPassword("");
        setLabel("");
        setSelectedAccount("");
        setExpiryHours("0");
        // Reload links
        const data = await fetch("/api/viewer-links").then((r) => r.json());
        setLinks(data.links || []);
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (link: SharedLink) => {
    const newStatus = link.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    try {
      const res = await fetch(`/api/viewer-links/${link.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setLinks((prev) => prev.map((l) => l.id === link.id ? { ...l, status: newStatus } : l));
        toast.success(t("linkUpdated"));
      }
    } catch { toast.error(t("error")); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteInvitation") + "?")) return;
    try {
      const res = await fetch(`/api/viewer-links/${id}`, { method: "DELETE" });
      if (res.ok) {
        setLinks((prev) => prev.filter((l) => l.id !== id));
        toast.success(t("linkDeleted"));
      }
    } catch { toast.error(t("error")); }
  };

  const handleResetPassword = async () => {
    if (!resetDialogId || !newPassword || newPassword.length < 4) return;
    setResetting(true);
    try {
      const res = await fetch(`/api/viewer-links/${resetDialogId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: newPassword }),
      });
      if (res.ok) {
        toast.success(t("passwordReset"));
        setResetDialogId(null);
        setNewPassword("");
      }
    } catch { toast.error(t("error")); }
    finally { setResetting(false); }
  };

  const getShareUrl = (code: string) => `${window.location.origin}/s/${code}`;

  const handleCopy = (link: SharedLink) => {
    navigator.clipboard.writeText(getShareUrl(link.code));
    setCopiedId(link.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

  const isExpired = (link: SharedLink) =>
    link.expiresAt && new Date() > new Date(link.expiresAt);

  const statusBadge = (link: SharedLink) => {
    if (isExpired(link)) return <Badge variant="secondary">{t("linkExpired")}</Badge>;
    if (link.status === "SUSPENDED") return <Badge variant="destructive">{t("linkSuspended")}</Badge>;
    return <Badge className="bg-green-600">{t("active")}</Badge>;
  };

  if (!canAccess) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-muted-foreground">{t("subscriptionRequired")}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link2 className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">{t("viewerLinksTitle")}</h1>
          <p className="text-sm text-muted-foreground">{t("viewerLinksDescription")}</p>
        </div>
      </div>

      {/* Create Link */}
      <Card>
        <CardHeader>
          <CardTitle>{t("createViewerLink")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("selectAccount")}</Label>
              <Select value={selectedAccount} onValueChange={(v) => setSelectedAccount(v ?? "")}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.displayName} ({a.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("linkPassword")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("linkPasswordPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("linkLabel")}</Label>
              <Input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("linkLabelPlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("linkExpiry")}</Label>
              <Select value={expiryHours} onValueChange={(v) => setExpiryHours(v ?? "0")}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EXPIRY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(opt.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={handleCreate} disabled={creating || !selectedAccount || password.length < 4}>
            {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Link2 className="mr-2 h-4 w-4" />}
            {t("createViewerLink")}
          </Button>
        </CardContent>
      </Card>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("viewerLinksTitle")} ({links.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {links.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">{t("viewerLinkEmpty")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("email")}</TableHead>
                  <TableHead>{t("linkLabel")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("linkViews")}</TableHead>
                  <TableHead>{t("linkExpiry")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell className="text-sm">{link.linkedAccount.email}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{link.label || "—"}</TableCell>
                    <TableCell>{statusBadge(link)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span className="text-sm">{link.viewCount}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {link.expiresAt ? formatDate(link.expiresAt) : t("linkNoExpiry")}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{formatDate(link.createdAt)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="outline" size="sm" onClick={() => handleCopy(link)}>
                          {copiedId === link.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleToggle(link)}>
                          {link.status === "ACTIVE" ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => { setResetDialogId(link.id); setNewPassword(""); }}>
                          <KeyRound className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(link.id)}>
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

      {/* Reset Password Dialog */}
      <Dialog open={!!resetDialogId} onOpenChange={() => setResetDialogId(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("resetPassword")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder={t("newPasswordPlaceholder")}
            />
            <Button onClick={handleResetPassword} disabled={resetting || newPassword.length < 4} className="w-full">
              {resetting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t("resetPassword")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
