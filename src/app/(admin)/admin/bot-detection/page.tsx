"use client";

import { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  Loader2,
  Search,
  Ban,
} from "lucide-react";
import { t } from "@/i18n";
import { toast } from "sonner";
import { LoadingText } from "@/components/ui/loading-text";

interface BotLogEntry {
  id: string;
  ip: string;
  userAgent: string | null;
  path: string;
  reason: string;
  provider: string | null;
  country: string | null;
  isp: string | null;
  asn: string | null;
  blockScore: number | null;
  action: string;
  createdAt: string;
}

interface BlockedIpEntry {
  id: string;
  ip: string;
  reason: string | null;
  createdAt: string;
}

interface Stats {
  blockedToday: number;
  blockedWeek: number;
  blockedMonth: number;
  topIps: { ip: string; count: number }[];
  topCountries: { country: string; count: number }[];
  reasonBreakdown: { reason: string; count: number }[];
}

export default function BotDetectionPage() {
  const { status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings
  const [settings, setSettings] = useState<Record<string, string>>({});

  // Logs
  const [logs, setLogs] = useState<BotLogEntry[]>([]);
  const [logsTotal, setLogsTotal] = useState(0);
  const [logsPage, setLogsPage] = useState(1);

  // Stats
  const [stats, setStats] = useState<Stats | null>(null);

  // Blocklist
  const [blocklist, setBlocklist] = useState<BlockedIpEntry[]>([]);
  const [newIps, setNewIps] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [addingIps, setAddingIps] = useState(false);

  // Test
  const [testIp, setTestIp] = useState("");
  const [testResult, setTestResult] = useState<Record<string, unknown> | null>(null);
  const [testing, setTesting] = useState(false);

  const getSetting = (key: string, fallback = "") => settings[`botDetection.${key}`] ?? fallback;
  const getBool = (key: string, fallback = false) => {
    const v = settings[`botDetection.${key}`];
    if (v === undefined) return fallback;
    return v === "true";
  };

  const updateSetting = (key: string, value: string) => {
    setSettings((prev) => ({ ...prev, [`botDetection.${key}`]: value }));
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [settingsRes, logsRes, statsRes, blocklistRes] = await Promise.all([
        fetch("/api/admin/bot-detection/settings"),
        fetch("/api/admin/bot-logs?page=1&limit=20"),
        fetch("/api/admin/bot-logs/stats"),
        fetch("/api/admin/bot-detection/blocklist"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSettings(data.settings || {});
      }
      if (logsRes.ok) {
        const data = await logsRes.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
      if (statsRes.ok) {
        setStats(await statsRes.json());
      }
      if (blocklistRes.ok) {
        const data = await blocklistRes.json();
        setBlocklist(data.blocklist || []);
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  }, []);

  const loadLogs = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/bot-logs?page=${logsPage}&limit=20`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setLogsTotal(data.total || 0);
      }
    } catch { /* non-critical */ }
  }, [logsPage]);

  useEffect(() => {
    if (status === "authenticated") loadAll();
  }, [status, loadAll]);

  useEffect(() => {
    if (!loading && logsPage > 1) loadLogs();
  }, [logsPage, loadLogs, loading]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/bot-detection/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings }),
      });
      if (res.ok) toast.success(t("settingsSaved"));
      else toast.error(t("error"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testIp.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch("/api/admin/bot-detection/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip: testIp.trim(), provider: "iphub" }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      toast.error(t("error"));
    } finally {
      setTesting(false);
    }
  };

  const handleAddIps = async () => {
    if (!newIps.trim()) return;
    setAddingIps(true);
    try {
      const res = await fetch("/api/admin/bot-detection/blocklist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ips: newIps, reason: blockReason }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(`${data.added} ${t("ipsAdded")}`);
        setNewIps("");
        setBlockReason("");
        loadAll();
      } else {
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setAddingIps(false);
    }
  };

  const handleRemoveIp = async (ip: string) => {
    try {
      const res = await fetch("/api/admin/bot-detection/blocklist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ip }),
      });
      if (res.ok) {
        toast.success(t("ipRemoved"));
        setBlocklist((prev) => prev.filter((b) => b.ip !== ip));
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

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
        <Shield className="h-8 w-8" />
        <div>
          <h1 className="text-3xl font-bold">{t("botDetection")}</h1>
          <p className="text-sm text-muted-foreground">{t("botDetectionDescription")}</p>
        </div>
      </div>

      <Tabs defaultValue="settings">
        <TabsList>
          <TabsTrigger value="settings">{t("adminSettings")}</TabsTrigger>
          <TabsTrigger value="blocklist">{t("ipBlocklist")}</TabsTrigger>
          <TabsTrigger value="logs">{t("botLogs")}</TabsTrigger>
          <TabsTrigger value="stats">{t("overview")}</TabsTrigger>
        </TabsList>

        {/* ─── SETTINGS TAB ─── */}
        <TabsContent value="settings" className="space-y-4">
          {/* Master Controls */}
          <Card>
            <CardHeader>
              <CardTitle>{t("botDetection")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("botDetectionEnabled")}</Label>
                  <p className="text-xs text-muted-foreground">{t("botDetectionMasterToggle")}</p>
                </div>
                <Switch
                  checked={getBool("enabled")}
                  onCheckedChange={(v) => updateSetting("enabled", String(v))}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("failOpen")}</Label>
                  <p className="text-xs text-muted-foreground">{t("failOpenDesc")}</p>
                </div>
                <Switch
                  checked={getBool("failOpen", true)}
                  onCheckedChange={(v) => updateSetting("failOpen", String(v))}
                />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <Label>{t("uaDetectionEnabled")}</Label>
                  <p className="text-xs text-muted-foreground">{t("uaDetectionDesc")}</p>
                </div>
                <Switch
                  checked={getBool("uaDetection.enabled", true)}
                  onCheckedChange={(v) => updateSetting("uaDetection.enabled", String(v))}
                />
              </div>
              <Separator />
              <div className="space-y-2">
                <Label>{t("cacheTtl")}</Label>
                <p className="text-xs text-muted-foreground">{t("cacheTtlDesc")}</p>
                <Input
                  type="number"
                  className="max-w-xs"
                  value={getSetting("cacheTtlSeconds", "86400")}
                  onChange={(e) => updateSetting("cacheTtlSeconds", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* IPHub */}
          <Card>
            <CardHeader>
              <CardTitle>{t("iphubConfig")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("iphubEnabled")}</Label>
                <Switch
                  checked={getBool("iphub.enabled")}
                  onCheckedChange={(v) => updateSetting("iphub.enabled", String(v))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("iphubApiKey")}</Label>
                <Input
                  type="password"
                  className="max-w-md"
                  value={getSetting("iphub.apiKey")}
                  onChange={(e) => updateSetting("iphub.apiKey", e.target.value)}
                  placeholder={t("iphubApiKey")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Secondary API */}
          <Card>
            <CardHeader>
              <CardTitle>{t("secondaryApiConfig")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>{t("secondaryEnabled")}</Label>
                <Switch
                  checked={getBool("secondary.enabled")}
                  onCheckedChange={(v) => updateSetting("secondary.enabled", String(v))}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("secondaryApiUrl")}</Label>
                <Input
                  className="max-w-md"
                  value={getSetting("secondary.apiUrl")}
                  onChange={(e) => updateSetting("secondary.apiUrl", e.target.value)}
                  placeholder={t("secondaryApiUrl")}
                />
              </div>
              <div className="space-y-2">
                <Label>{t("secondaryApiKey")}</Label>
                <Input
                  type="password"
                  className="max-w-md"
                  value={getSetting("secondary.apiKey")}
                  onChange={(e) => updateSetting("secondary.apiKey", e.target.value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Whitelists */}
          <Card>
            <CardHeader>
              <CardTitle>{t("trustedIsps")}</CardTitle>
              <CardDescription>{t("trustedIspsDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[120px]"
                value={(() => {
                  try { return JSON.parse(getSetting("trustedIsps", "[]")).join("\n"); } catch { return ""; }
                })()}
                onChange={(e) => updateSetting("trustedIsps", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
                placeholder="cloudflare&#10;apple&#10;comcast&#10;verizon"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("allowedAsns")}</CardTitle>
              <CardDescription>{t("allowedAsnsDesc")}</CardDescription>
            </CardHeader>
            <CardContent>
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[100px]"
                value={(() => {
                  try { return JSON.parse(getSetting("allowedAsns", "[]")).join("\n"); } catch { return ""; }
                })()}
                onChange={(e) => updateSetting("allowedAsns", JSON.stringify(e.target.value.split("\n").filter(Boolean)))}
                placeholder="13335&#10;8075&#10;16509"
              />
            </CardContent>
          </Card>

          {/* Test IP */}
          <Card>
            <CardHeader>
              <CardTitle>{t("testIp")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input
                  className="max-w-xs"
                  value={testIp}
                  onChange={(e) => setTestIp(e.target.value)}
                  placeholder={t("testIpPlaceholder")}
                />
                <Button onClick={handleTest} disabled={testing || !testIp.trim()}>
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="mr-1 h-4 w-4" />}
                  {t("testIp")}
                </Button>
              </div>
              {testResult && (
                <pre className="rounded border border-border bg-muted p-3 text-xs overflow-auto max-h-48">
                  {JSON.stringify(testResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSave} disabled={saving} size="lg">
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {t("save")}
          </Button>
        </TabsContent>

        {/* ─── BLOCKLIST TAB ─── */}
        <TabsContent value="blocklist" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ban className="h-5 w-5" />
                {t("ipBlocklist")}
              </CardTitle>
              <CardDescription>{t("ipBlocklistDesc")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <textarea
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm min-h-[120px] font-mono"
                value={newIps}
                onChange={(e) => setNewIps(e.target.value)}
                placeholder={t("ipAddressPlaceholder")}
              />
              <Input
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t("blockReasonPlaceholder")}
                className="max-w-md"
              />
              <Button onClick={handleAddIps} disabled={addingIps || !newIps.trim()}>
                {addingIps ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Ban className="mr-2 h-4 w-4" />}
                {t("addToBlocklist")}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("ipBlocklist")} ({blocklist.length})</CardTitle>
            </CardHeader>
            <CardContent>
              {blocklist.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t("blocklistEmpty")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>IP</TableHead>
                      <TableHead>{t("blockReason")}</TableHead>
                      <TableHead>{t("date")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {blocklist.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="font-mono text-sm">{entry.ip}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{entry.reason || "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatDate(entry.createdAt)}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleRemoveIp(entry.ip)}>
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
        </TabsContent>

        {/* ─── LOGS TAB ─── */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("botLogs")} ({logsTotal})</CardTitle>
            </CardHeader>
            <CardContent>
              {logs.length === 0 ? (
                <p className="py-8 text-center text-muted-foreground">{t("botLogsEmpty")}</p>
              ) : (
                <>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("date")}</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead>{t("country")}</TableHead>
                        <TableHead>ISP</TableHead>
                        <TableHead>{t("blockReason")}</TableHead>
                        <TableHead>{t("provider")}</TableHead>
                        <TableHead>{t("path")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{formatDate(log.createdAt)}</TableCell>
                          <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                          <TableCell className="text-xs">{log.country || "—"}</TableCell>
                          <TableCell className="text-xs max-w-[150px] truncate">{log.isp || "—"}</TableCell>
                          <TableCell>
                            <Badge variant="destructive" className="text-xs">{log.reason}</Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">{log.provider || "—"}</TableCell>
                          <TableCell className="text-xs font-mono max-w-[120px] truncate">{log.path}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  <div className="flex justify-between items-center mt-4">
                    <span className="text-xs text-muted-foreground">{logsTotal} {t("total")}</span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsPage <= 1}
                        onClick={() => setLogsPage((p) => p - 1)}
                      >
                        {t("previous")}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={logsPage * 20 >= logsTotal}
                        onClick={() => setLogsPage((p) => p + 1)}
                      >
                        {t("next")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── STATS TAB ─── */}
        <TabsContent value="stats" className="space-y-4">
          {!stats && (
            <p className="py-12 text-center text-muted-foreground">{t("botLogsEmpty")}</p>
          )}
          {stats && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-8 w-8 text-red-500" />
                      <div>
                        <p className="text-2xl font-bold">{stats.blockedToday}</p>
                        <p className="text-xs text-muted-foreground">{t("blockedToday")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldAlert className="h-8 w-8 text-orange-500" />
                      <div>
                        <p className="text-2xl font-bold">{stats.blockedWeek}</p>
                        <p className="text-xs text-muted-foreground">{t("blockedThisWeek")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex items-center gap-3">
                      <ShieldCheck className="h-8 w-8 text-green-500" />
                      <div>
                        <p className="text-2xl font-bold">{stats.blockedMonth}</p>
                        <p className="text-xs text-muted-foreground">{t("blockedThisMonth")}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("topBlockedIps")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topIps.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topIps.map((item) => (
                          <div key={item.ip} className="flex justify-between items-center">
                            <span className="font-mono text-xs">{item.ip}</span>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">{t("topBlockedCountries")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.topCountries.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.topCountries.map((item) => (
                          <div key={item.country} className="flex justify-between items-center">
                            <span className="text-sm">{item.country}</span>
                            <Badge variant="secondary">{item.count}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardHeader>
                    <CardTitle className="text-sm">{t("blockReasons")}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {stats.reasonBreakdown.length === 0 ? (
                      <p className="text-sm text-muted-foreground">—</p>
                    ) : (
                      <div className="space-y-2">
                        {stats.reasonBreakdown.map((item) => (
                          <div key={item.reason} className="flex justify-between items-center">
                            <Badge variant="outline" className="text-xs">{item.reason}</Badge>
                            <span className="text-sm font-medium">{item.count}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
