"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
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
  Ear,
  Plus,
  Trash2,
  Mail,
  Bell,
  Search,
} from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface KeywordRule {
  id: string;
  name: string;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string; value?: string }[];
  isActive: boolean;
  triggerCount: number;
  lastTriggeredAt: string | null;
  linkedAccountId?: string;
}

interface MatchLog {
  id: string;
  action: string;
  emailSubject: string | null;
  emailFrom: string | null;
  ruleName: string | null;
  createdAt: string;
  linkedAccount: { email: string };
}

export default function KeywordListenerPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [keywords, setKeywords] = useState<KeywordRule[]>([]);
  const [matches, setMatches] = useState<MatchLog[]>([]);

  // Add keyword form
  const [newKeyword, setNewKeyword] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState("all");
  const [adding, setAdding] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const accountsRes = await fetch("/api/accounts");
      if (!accountsRes.ok) return;
      const accountsData = await accountsRes.json();
      const accs: Account[] = accountsData.accounts || [];
      setAccounts(accs);

      // Load keyword rules from all accounts
      const allRules: KeywordRule[] = [];
      for (const acc of accs.filter((a) => a.status === "ACTIVE")) {
        try {
          const res = await fetch(`/api/rules?accountId=${acc.id}`);
          if (res.ok) {
            const data = await res.json();
            for (const rule of data.rules || []) {
              const conds = rule.conditions || [];
              const hasKeywordCondition = conds.some((c: { field: string; operator: string }) =>
                (c.field === "subject" || c.field === "body") && c.operator === "contains"
              );
              if (hasKeywordCondition) {
                allRules.push({ ...rule, linkedAccountId: acc.id });
              }
            }
          }
        } catch { /* continue */ }
      }
      setKeywords(allRules);

      // Load recent alert matches from activity log
      const activityRes = await fetch("/api/activity-log?limit=100");
      if (activityRes.ok) {
        const activityData = await activityRes.json();
        const alertLogs = (activityData.logs || []).filter((log: MatchLog) => log.ruleName);
        setMatches(alertLogs);
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadData();
  }, [status, loadData]);

  const handleAddKeyword = async () => {
    if (!newKeyword.trim()) return;
    const targetAccounts = selectedAccountId === "all"
      ? accounts.filter((a) => a.status === "ACTIVE")
      : accounts.filter((a) => a.id === selectedAccountId && a.status === "ACTIVE");

    if (targetAccounts.length === 0) {
      toast.error(t("accountNotActive"));
      return;
    }

    setAdding(true);
    let created = 0;

    for (const acc of targetAccounts) {
      try {
        const res = await fetch("/api/rules", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId: acc.id,
            name: `Keyword: ${newKeyword.trim()}`,
            conditions: [
              { field: "subject", operator: "contains", value: newKeyword.trim() },
              { field: "body", operator: "contains", value: newKeyword.trim() },
            ],
            conditionLogic: "OR",
            actions: [{ type: "telegramAlert", value: `Keyword "${newKeyword.trim()}" detected` }],
            stopProcessing: false,
            priority: 0,
          }),
        });
        if (res.ok) created++;
      } catch { /* continue */ }
    }

    if (created > 0) {
      toast.success(t("keywordListenerCreated", { count: String(created) }));
      setNewKeyword("");
      loadData();
    } else {
      toast.error(t("settingsSaveFailed"));
    }
    setAdding(false);
  };

  const handleDeleteKeyword = async (rule: KeywordRule) => {
    if (!confirm(t("settingsRulesDeleteConfirm"))) return;
    try {
      const res = await fetch(`/api/rules/${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        setKeywords((prev) => prev.filter((k) => k.id !== rule.id));
        toast.success(t("settingsSaved"));
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const getKeywordFromRule = (rule: KeywordRule) => {
    const cond = (rule.conditions || []).find((c) =>
      (c.field === "subject" || c.field === "body") && c.operator === "contains"
    );
    return cond?.value || rule.name;
  };

  const getAccountEmail = (accountId?: string) => {
    const acc = accounts.find((a) => a.id === accountId);
    return acc?.email || "—";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Ear className="h-7 w-7" />
        {t("keywordListener")}
      </h1>

      {/* Add Keyword */}
      <Card>
        <CardHeader>
          <CardTitle>{t("keywordListener")}</CardTitle>
          <CardDescription>{t("keywordListenerDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px] max-w-sm">
              <Input
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder={t("keywordListenerKeywordPlaceholder")}
                onKeyDown={(e) => { if (e.key === "Enter") handleAddKeyword(); }}
              />
            </div>
            <div>
              <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
                <SelectTrigger className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("keywordListenerAllAccounts")}</SelectItem>
                  {accounts.filter((a) => a.status === "ACTIVE").map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button onClick={handleAddKeyword} disabled={adding || !newKeyword.trim()}>
              <Plus className="mr-1 h-3 w-3" />
              {adding ? t("loading") : t("keywordListenerAdd")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Keywords */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            {t("keywordListenerActive", { count: String(keywords.length) })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {keywords.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("keywordListenerNoKeywords")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("keywordListenerKeyword")}</TableHead>
                  <TableHead>{t("keywordListenerAccount")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("keywordListenerMatches")}</TableHead>
                  <TableHead>{t("ruleLastTriggered")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {keywords.map((kw) => (
                  <TableRow key={kw.id}>
                    <TableCell className="font-medium">{getKeywordFromRule(kw)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{getAccountEmail(kw.linkedAccountId)}</TableCell>
                    <TableCell>
                      <Badge className={kw.isActive ? "bg-green-600" : ""}>{kw.isActive ? t("on") : t("off")}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{kw.triggerCount}x</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {kw.lastTriggeredAt
                        ? new Date(kw.lastTriggeredAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                        : t("ruleNeverTriggered")}
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" onClick={() => handleDeleteKeyword(kw)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Matches */}
      {matches.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-5 w-5" />
              {t("keywordListenerMatches")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("activityLogRule")}</TableHead>
                  <TableHead>{t("activityLogEmail")}</TableHead>
                  <TableHead>{t("accounts")}</TableHead>
                  <TableHead>{t("activityLogTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.slice(0, 50).map((match) => (
                  <TableRow key={match.id}>
                    <TableCell>
                      <Badge variant="secondary">{match.ruleName}</Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm truncate max-w-[250px]">{match.emailSubject || "—"}</div>
                      <div className="text-xs text-muted-foreground truncate">{match.emailFrom || ""}</div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{match.linkedAccount.email}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(match.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
