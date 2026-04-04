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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EyeOff,
  Mail,
  ExternalLink,
  Shield,
  AlertTriangle,
  ArrowRight,
  FolderInput,
  Lock,
  Zap,
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

interface AccountSettingsData {
  forwardingEnabled: boolean;
  forwardingEmail: string | null;
  autoReplyEnabled: boolean;
  suppressSecurityAlerts: boolean;
  suppressSystemMessages: boolean;
  silentForwardEnabled: boolean;
  silentForwardEmail: string | null;
  silentInboxEnabled: boolean;
  silentInboxMarkRead: boolean;
  fullSilentMode: boolean;
}

interface RuleData {
  id: string;
  name: string;
  isActive: boolean;
  conditions: { field: string; operator: string; value: string }[];
  actions: { type: string }[];
  triggerCount: number;
}

export default function RulesStealthPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [settings, setSettings] = useState<AccountSettingsData | null>(null);
  const [rules, setRules] = useState<RuleData[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [status]);

  const handleAccountSelect = async (accountId: string) => {
    setSelectedAccountId(accountId);
    const account = accounts.find((a) => a.id === accountId);
    if (account?.status !== "ACTIVE") {
      toast.error(t("accountNotActive"));
      return;
    }
    setDataLoading(true);
    try {
      const [settingsRes, rulesRes] = await Promise.all([
        fetch(`/api/account-settings?accountId=${accountId}`),
        fetch(`/api/rules?accountId=${accountId}`),
      ]);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings || null);
      }
      if (rulesRes.ok) {
        const data = await rulesRes.json();
        setRules(data.rules || []);
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setDataLoading(false);
    }
  };

  const stealthItems = settings ? [
    { icon: Shield, label: t("settingsSuppressSecurityAlerts"), active: settings.suppressSecurityAlerts },
    { icon: AlertTriangle, label: t("settingsSuppressSystemMessages"), active: settings.suppressSystemMessages },
    { icon: ArrowRight, label: t("settingsSilentForward"), active: settings.silentForwardEnabled, detail: settings.silentForwardEmail },
    { icon: FolderInput, label: t("settingsSilentInbox"), active: settings.silentInboxEnabled, detail: settings.silentInboxMarkRead ? t("settingsSilentInboxMarkRead") : undefined },
    { icon: Lock, label: t("settingsFullSilentMode"), active: settings.fullSilentMode },
    { icon: ArrowRight, label: t("settingsForwardingEnabled"), active: settings.forwardingEnabled, detail: settings.forwardingEmail },
    { icon: Mail, label: t("settingsAutoReplyEnabled"), active: settings.autoReplyEnabled },
  ] : [];

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
        <EyeOff className="h-7 w-7" />
        {t("rulesStealth")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("rulesStealth")}</CardTitle>
          <CardDescription>{t("rulesStealthDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Select value={selectedAccountId} onValueChange={(v) => v && handleAccountSelect(v)}>
              <SelectTrigger className="w-full max-w-md">
                <SelectValue placeholder={t("selectAccount")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="" disabled>{t("selectAccount")}</SelectItem>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    <div className="flex items-center gap-2">
                      <Mail className="h-3 w-3" />
                      {a.email}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedAccountId && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.open(`/email/${selectedAccountId}`, "_blank")}
              >
                <ExternalLink className="mr-1 h-3 w-3" />
                {t("openSettings")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selectedAccountId && !dataLoading && settings && (
        <>
          {/* Stealth Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <EyeOff className="h-5 w-5" />
                {t("settingsSilentModeTitle")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {stealthItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-3 rounded-md border border-border p-3">
                    <item.icon className={`h-4 w-4 ${item.active ? "text-green-500" : "text-muted-foreground/40"}`} />
                    <div className="flex-1 min-w-0">
                      <div className={`text-sm ${item.active ? "font-medium" : "text-muted-foreground"}`}>
                        {item.label}
                      </div>
                      {item.detail && item.active && (
                        <div className="text-xs text-muted-foreground truncate">{item.detail}</div>
                      )}
                    </div>
                    <Badge variant={item.active ? "default" : "outline"} className={item.active ? "bg-green-600" : ""}>
                      {item.active ? t("on") : t("off")}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Rules */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                {t("settingsRulesTitle")}
                {rules.length > 0 && <Badge variant="outline">{rules.length}</Badge>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {rules.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">{t("settingsRulesNoRules")}</p>
              ) : (
                <div className="space-y-2">
                  {rules.map((rule) => (
                    <div key={rule.id} className="flex items-center gap-3 rounded-md border border-border p-3">
                      <div className={`h-2 w-2 rounded-full ${rule.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{rule.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {rule.conditions?.length || 0} {t("ruleBuilderConditions").toLowerCase()} → {rule.actions?.length || 0} {t("ruleBuilderActions").toLowerCase()}
                          {rule.triggerCount > 0 && ` · ${rule.triggerCount}x ${t("ruleTriggered")}`}
                        </div>
                      </div>
                      <Badge variant={rule.isActive ? "default" : "outline"} className={rule.isActive ? "bg-green-600" : ""}>
                        {rule.isActive ? t("on") : t("off")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {dataLoading && (
        <div className="flex items-center justify-center py-12">
          <LoadingText className="text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
