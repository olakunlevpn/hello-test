"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
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
  Activity,
  ArrowRight,
  Trash2,
  Eye,
  Flag,
  Tag,
  Bell,
  Reply,
  Shield,
  AlertTriangle,
  FolderInput,
} from "lucide-react";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
}

interface LogEntry {
  id: string;
  action: string;
  details: string | null;
  emailSubject: string | null;
  emailFrom: string | null;
  ruleName: string | null;
  createdAt: string;
  linkedAccount: { email: string; displayName: string };
}

const actionConfig: Record<string, { icon: typeof ArrowRight; color: string; label: string }> = {
  forward: { icon: ArrowRight, color: "text-blue-500", label: "Forward" },
  silentForward: { icon: ArrowRight, color: "text-purple-500", label: "Silent Forward" },
  delete: { icon: Trash2, color: "text-red-500", label: "Delete" },
  blockSender: { icon: Trash2, color: "text-red-500", label: "Block Sender" },
  moveToFolder: { icon: FolderInput, color: "text-orange-500", label: "Move" },
  markAsRead: { icon: Eye, color: "text-green-500", label: "Mark Read" },
  flag: { icon: Flag, color: "text-yellow-500", label: "Flag" },
  setCategory: { icon: Tag, color: "text-cyan-500", label: "Category" },
  telegramAlert: { icon: Bell, color: "text-blue-400", label: "Telegram" },
  autoReply: { icon: Reply, color: "text-emerald-500", label: "Auto-Reply" },
  suppressSecurityAlert: { icon: Shield, color: "text-red-400", label: "Suppress Alert" },
  suppressSystemMessage: { icon: AlertTriangle, color: "text-orange-400", label: "Suppress System" },
};

export default function ActivityLogPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {});
  }, [status]);

  const loadLogs = useCallback(async (accountId?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "200" });
      if (accountId) params.set("accountId", accountId);
      const res = await fetch(`/api/activity-log?${params}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadLogs();
  }, [status, loadLogs]);

  const handleAccountFilter = (value: string) => {
    setSelectedAccountId(value);
    if (value === "all") loadLogs();
    else loadLogs(value);
  };

  const getActionDisplay = (action: string) => {
    const config = actionConfig[action];
    if (!config) return { Icon: Activity, color: "text-muted-foreground", label: action };
    return { Icon: config.icon, color: config.color, label: config.label };
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Activity className="h-7 w-7" />
        {t("activityLog")}
      </h1>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t("activityLog")}</CardTitle>
              <CardDescription>{t("activityLogDescription")}</CardDescription>
            </div>
            <Select value={selectedAccountId || "all"} onValueChange={(v) => v && handleAccountFilter(v)}>
              <SelectTrigger className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filterAll")}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <LoadingText className="text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{t("activityLogNoLogs")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>{t("activityLogAction")}</TableHead>
                  <TableHead>{t("activityLogEmail")}</TableHead>
                  <TableHead>{t("activityLogDetails")}</TableHead>
                  <TableHead>{t("activityLogRule")}</TableHead>
                  <TableHead>{t("accounts")}</TableHead>
                  <TableHead>{t("activityLogTime")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => {
                  const { Icon, color, label } = getActionDisplay(log.action);
                  return (
                    <TableRow key={log.id}>
                      <TableCell>
                        <Icon className={`h-4 w-4 ${color}`} />
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={color}>{label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px]">
                        <div className="text-sm truncate">{log.emailSubject || "—"}</div>
                        <div className="text-xs text-muted-foreground truncate">{log.emailFrom || ""}</div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                        {log.details || "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.ruleName ? (
                          <Badge variant="secondary">{log.ruleName}</Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {log.linkedAccount.email}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
