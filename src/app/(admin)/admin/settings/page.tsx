"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { LoadingText } from "@/components/ui/loading-text";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  DollarSign,
  Info,
  Plus,
  Trash2,
  GripVertical,
  Check,
  Pencil,
  X,
  KeyRound,
  Copy,
} from "lucide-react";
import { t } from "@/i18n";

interface PricingInfo {
  monthly: number;
  yearly: number;
}

interface PlanFeature {
  id: string;
  text: string;
  sortOrder: number;
  isActive: boolean;
}

interface AuthToken {
  id: string;
  token: string;
  expiresAt: string;
  usedAt: string | null;
  createdAt: string;
  createdBy: { id: string; name: string | null; email: string };
  usedBy: { id: string; name: string | null; email: string } | null;
}

export default function AdminSettingsPage() {
  const [prices, setPrices] = useState<PricingInfo | null>(null);
  const [loading, setLoading] = useState(true);

  // Features state
  const [features, setFeatures] = useState<PlanFeature[]>([]);
  const [featuresLoading, setFeaturesLoading] = useState(true);
  const [newFeatureText, setNewFeatureText] = useState("");
  const [addingFeature, setAddingFeature] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Authorization tokens state
  const [authTokens, setAuthTokens] = useState<AuthToken[]>([]);
  const [authTokensLoading, setAuthTokensLoading] = useState(true);
  const [generatingToken, setGeneratingToken] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [newlyGeneratedToken, setNewlyGeneratedToken] = useState<string | null>(null);
  const [copiedTokenId, setCopiedTokenId] = useState<string | null>(null);

  // System settings
  const [telegramChannelUrl, setTelegramChannelUrl] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  useEffect(() => {
    fetch("/api/admin/system-settings")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.settings?.telegramChannelUrl) {
          setTelegramChannelUrl(data.settings.telegramChannelUrl);
        }
      })
      .catch(() => {});
  }, []);

  const handleSaveTelegramUrl = async () => {
    setSavingTelegram(true);
    try {
      const res = await fetch("/api/admin/system-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "telegramChannelUrl", value: telegramChannelUrl }),
      });
      if (res.ok) toast.success(t("telegramChannelUrlSaved"));
      else toast.error(t("error"));
    } catch {
      toast.error(t("error"));
    } finally {
      setSavingTelegram(false);
    }
  };

  useEffect(() => {
    fetch("/api/billing")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.prices) setPrices(data.prices);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const loadFeatures = useCallback(() => {
    setFeaturesLoading(true);
    fetch("/api/admin/features")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.features) setFeatures(data.features);
        setFeaturesLoading(false);
      })
      .catch(() => setFeaturesLoading(false));
  }, []);

  useEffect(() => {
    loadFeatures();
  }, [loadFeatures]);

  const loadAuthTokens = useCallback(() => {
    setAuthTokensLoading(true);
    fetch("/api/admin/auth-tokens")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.tokens) setAuthTokens(data.tokens);
        setAuthTokensLoading(false);
      })
      .catch(() => setAuthTokensLoading(false));
  }, []);

  useEffect(() => {
    loadAuthTokens();
  }, [loadAuthTokens]);

  const handleGenerateToken = async () => {
    setGeneratingToken(true);
    setNewlyGeneratedToken(null);
    try {
      const res = await fetch("/api/admin/auth-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ expiresInHours: Number(expiresInHours) }),
      });
      if (res.ok) {
        const data = await res.json();
        setNewlyGeneratedToken(data.token.token);
        loadAuthTokens();
      }
    } catch {
      // silently handle
    } finally {
      setGeneratingToken(false);
    }
  };

  const handleCopyToken = (tokenStr: string, tokenId: string) => {
    navigator.clipboard.writeText(tokenStr).then(() => {
      setCopiedTokenId(tokenId);
      setTimeout(() => setCopiedTokenId(null), 2000);
    });
  };

  const handleAddFeature = async () => {
    if (!newFeatureText.trim()) return;
    setAddingFeature(true);
    try {
      const res = await fetch("/api/admin/features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: newFeatureText }),
      });
      if (res.ok) {
        setNewFeatureText("");
        loadFeatures();
      }
    } catch {
      // silently handle
    } finally {
      setAddingFeature(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (res.ok) loadFeatures();
    } catch {
      // silently handle
    }
  };

  const handleSaveEdit = async (id: string) => {
    if (!editText.trim()) return;
    try {
      const res = await fetch(`/api/admin/features/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: editText }),
      });
      if (res.ok) {
        setEditingId(null);
        loadFeatures();
      }
    } catch {
      // silently handle
    }
  };

  const handleDeleteFeature = async (id: string) => {
    if (!confirm(t("delete") + "?")) return;
    try {
      const res = await fetch(`/api/admin/features/${id}`, { method: "DELETE" });
      if (res.ok) loadFeatures();
    } catch {
      // silently handle
    }
  };

  const handleMoveFeature = async (id: string, direction: "up" | "down") => {
    const idx = features.findIndex((f) => f.id === id);
    if (idx === -1) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= features.length) return;

    const currentOrder = features[idx].sortOrder;
    const swapOrder = features[swapIdx].sortOrder;

    try {
      await Promise.all([
        fetch(`/api/admin/features/${features[idx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: swapOrder }),
        }),
        fetch(`/api/admin/features/${features[swapIdx].id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sortOrder: currentOrder }),
        }),
      ]);
      loadFeatures();
    } catch {
      // silently handle
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("adminSettings")}</h1>

      {/* General Settings */}
      <Card>
        <CardHeader>
          <CardTitle>{t("generalSettings")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-md">
              <label className="text-sm font-medium mb-1 block">{t("telegramChannelUrl")}</label>
              <Input
                value={telegramChannelUrl}
                onChange={(e) => setTelegramChannelUrl(e.target.value)}
                placeholder={t("telegramChannelUrlPlaceholder")}
              />
            </div>
            <Button onClick={handleSaveTelegramUrl} disabled={savingTelegram}>
              {savingTelegram ? t("loading") : t("save")}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Separator />

      {/* Pricing Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            {t("editPricing")}
          </CardTitle>
          <CardDescription>
            {t("pricingManagedByEnv")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
          ) : prices ? (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground">{t("monthly")}</p>
                  <p className="mt-1 text-3xl font-bold">${prices.monthly}</p>
                  <p className="text-xs text-muted-foreground">{t("perMonth")}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    PLAN_PRICE_MONTHLY_USD
                  </p>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <p className="text-sm font-medium text-muted-foreground">{t("yearly")}</p>
                  <p className="mt-1 text-3xl font-bold">${prices.yearly}</p>
                  <p className="text-xs text-muted-foreground">{t("perYear")}</p>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    PLAN_PRICE_YEARLY_USD
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {t("pricingManagedByEnv")}
                </p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">{t("error")}</p>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Plan Features Management */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5" />
            {t("planFeatures")}
          </CardTitle>
          <CardDescription>
            Manage features shown on the billing page. Toggle visibility or reorder.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Add new feature */}
          <div className="flex gap-2">
            <Input
              value={newFeatureText}
              onChange={(e) => setNewFeatureText(e.target.value)}
              placeholder="Enter new feature text..."
              onKeyDown={(e) => e.key === "Enter" && handleAddFeature()}
            />
            <Button
              onClick={handleAddFeature}
              disabled={addingFeature || !newFeatureText.trim()}
              size="sm"
            >
              <Plus className="mr-1 h-4 w-4" />
              Add
            </Button>
          </div>

          <Separator />

          {/* Features list */}
          {featuresLoading ? (
            <p className="text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
          ) : features.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("noResults")}</p>
          ) : (
            <div className="space-y-2">
              {features.map((feature, idx) => (
                <div
                  key={feature.id}
                  className="flex items-center gap-3 rounded-lg border border-border p-3"
                >
                  {/* Reorder buttons */}
                  <div className="flex flex-col gap-0.5">
                    <button
                      onClick={() => handleMoveFeature(feature.id, "up")}
                      disabled={idx === 0}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <GripVertical className="h-3 w-3 rotate-90" />
                    </button>
                    <button
                      onClick={() => handleMoveFeature(feature.id, "down")}
                      disabled={idx === features.length - 1}
                      className="text-muted-foreground hover:text-foreground disabled:opacity-20"
                    >
                      <GripVertical className="h-3 w-3 -rotate-90" />
                    </button>
                  </div>

                  {/* Active toggle */}
                  <Switch
                    checked={feature.isActive}
                    onCheckedChange={(checked) =>
                      handleToggleActive(feature.id, checked)
                    }
                  />

                  {/* Feature text */}
                  <div className="flex-1">
                    {editingId === feature.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(feature.id);
                            if (e.key === "Escape") setEditingId(null);
                          }}
                          autoFocus
                          className="h-8"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSaveEdit(feature.id)}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setEditingId(null)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span
                          className={
                            feature.isActive
                              ? "text-sm"
                              : "text-sm text-muted-foreground line-through"
                          }
                        >
                          {feature.text}
                        </span>
                        {!feature.isActive && (
                          <Badge variant="secondary" className="text-xs">
                            Hidden
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {editingId !== feature.id && (
                    <div className="flex gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setEditingId(feature.id);
                          setEditText(feature.text);
                        }}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteFeature(feature.id)}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <Separator />

      {/* Authorization Tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t("authTokens")}
          </CardTitle>
          <CardDescription>
            {t("enterTokenDescription")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate token controls */}
          <div className="flex flex-wrap items-center gap-2">
            <Select value={expiresInHours} onValueChange={(v) => v && setExpiresInHours(v)}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="24">{t("hours24")}</SelectItem>
                <SelectItem value="48">{t("hours48")}</SelectItem>
                <SelectItem value="72">{t("hours72")}</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={handleGenerateToken} disabled={generatingToken}>
              <Plus className="mr-2 h-4 w-4" />
              {generatingToken ? t("loading") : t("generateToken")}
            </Button>
          </div>

          {/* Newly generated token display */}
          {newlyGeneratedToken && (
            <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all font-mono text-sm">
                  {newlyGeneratedToken}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleCopyToken(newlyGeneratedToken, "new")}
                >
                  {copiedTokenId === "new" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">{t("shareableLink")}</p>
              <div className="flex items-center gap-2">
                <code className="flex-1 break-all rounded bg-muted p-2 text-xs">
                  {typeof window !== "undefined" ? `${window.location.origin}/authorize/${newlyGeneratedToken}` : `/authorize/${newlyGeneratedToken}`}
                </code>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() =>
                    handleCopyToken(
                      `${window.location.origin}/authorize/${newlyGeneratedToken}`,
                      "new-url"
                    )
                  }
                >
                  {copiedTokenId === "new-url" ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Token table */}
          {authTokensLoading ? (
            <p className="text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
          ) : authTokens.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("noTokens")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("authTokens")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("generatedBy")}</TableHead>
                  <TableHead>{t("generatedFor")}</TableHead>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("tokenExpiry")}</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {authTokens.map((tok) => {
                  const isPending = !tok.usedAt && new Date(tok.expiresAt) > new Date();
                  const isExpired = !tok.usedAt && new Date(tok.expiresAt) <= new Date();
                  return (
                    <TableRow key={tok.id}>
                      <TableCell className="font-mono text-sm">
                        {tok.token.slice(0, 8)}...
                      </TableCell>
                      <TableCell>
                        {tok.usedAt ? (
                          <Badge variant="secondary">{t("usedTokens")}</Badge>
                        ) : isExpired ? (
                          <Badge variant="destructive">{t("expired")}</Badge>
                        ) : (
                          <Badge className="bg-green-600">{t("pendingTokens")}</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tok.createdBy.name || tok.createdBy.email}
                      </TableCell>
                      <TableCell className="text-sm">
                        {tok.usedBy ? tok.usedBy.name || tok.usedBy.email : "—"}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(tok.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-sm">
                        {new Date(tok.expiresAt).toLocaleString()}
                      </TableCell>
                      <TableCell>
                        {isPending && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleCopyToken(tok.token, tok.id)}
                          >
                            {copiedTokenId === tok.id ? (
                              <Check className="h-4 w-4 text-green-500" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        )}
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
