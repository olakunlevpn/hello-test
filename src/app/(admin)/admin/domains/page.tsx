"use client";

import { useEffect, useState } from "react";
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
  Globe,
  Trash2,
  RefreshCw,
  Shield,
  CheckCircle,
  XCircle,
  Plus,
  Copy,
  Server,
} from "lucide-react";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

interface Domain {
  id: string;
  domain: string;
  verified: boolean;
  sslActive: boolean;
  isGlobal: boolean;
  createdAt: string;
}

export default function AdminDomainsPage() {
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [provisioningId, setProvisioningId] = useState<string | null>(null);
  const [pingingId, setPingingId] = useState<string | null>(null);

  const serverIp = "143.198.0.184";
  const platformDomain = "multitenant.sbs";

  const loadDomains = () => {
    setLoading(true);
    fetch("/api/admin/domains")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDomains(data.domains || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadDomains(); }, []);

  const handleAdd = async () => {
    if (!newDomain.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/domains", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: newDomain.trim() }),
      });
      if (res.ok) {
        toast.success(t("adminDomainAdded"));
        setNewDomain("");
        loadDomains();
      } else {
        const data = await res.json();
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("removeDomainConfirm"))) return;
    try {
      const res = await fetch(`/api/admin/domains/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("adminDomainDeleted"));
        setDomains((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const handleVerify = async (id: string) => {
    setVerifyingId(id);
    try {
      const res = await fetch(`/api/admin/domains/${id}/verify`, { method: "POST" });
      const data = await res.json();
      if (data.verified) {
        toast.success(t("domainVerified"));
        setDomains((prev) => prev.map((d) => d.id === id ? { ...d, verified: true } : d));
      } else {
        toast.error(data.message || t("domainNotVerified"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setVerifyingId(null);
    }
  };

  const handleProvision = async (id: string) => {
    setProvisioningId(id);
    try {
      const res = await fetch(`/api/admin/domains/${id}/provision`, { method: "POST" });
      const data = await res.json();
      if (data.sslActive) {
        toast.success(t("domainSslActive"));
        setDomains((prev) => prev.map((d) => d.id === id ? { ...d, sslActive: true } : d));
      } else {
        toast.error(data.error || t("error"));
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setProvisioningId(null);
    }
  };

  const handlePing = async (domain: Domain) => {
    setPingingId(domain.id);
    try {
      const res = await fetch(`https://${domain.domain}/api/health`, { mode: "no-cors" }).catch(() => null);
      if (res) {
        toast.success(`${domain.domain} is reachable`);
      } else {
        toast.error(`${domain.domain} is not reachable`);
      }
    } catch {
      toast.error(`${domain.domain} is not reachable`);
    } finally {
      setPingingId(null);
    }
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success(t("copied"));
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
        <Globe className="h-7 w-7" />
        {t("adminDomainsTitle")}
      </h1>

      {/* DNS Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Server className="h-5 w-5" />
            {t("dnsInstructions")}
          </CardTitle>
          <CardDescription>{t("adminDomainsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="rounded-md border border-border bg-muted/30 p-4 space-y-2 text-sm">
            <p>{t("adminDnsStep1")}</p>
            <p>{t("adminDnsStep2")}</p>
            <div className="flex items-center gap-2 ml-4">
              <code className="rounded bg-muted px-2 py-1 font-mono text-primary">{serverIp}</code>
              <Button variant="outline" size="sm" onClick={() => copyText(serverIp)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p>{t("adminDnsStep3")}</p>
            <div className="flex items-center gap-2 ml-4">
              <code className="rounded bg-muted px-2 py-1 font-mono text-primary">{platformDomain}</code>
              <Button variant="outline" size="sm" onClick={() => copyText(platformDomain)}>
                <Copy className="h-3 w-3" />
              </Button>
            </div>
            <p>{t("adminDnsStep4")}</p>
            <p>{t("adminDnsStep5")}</p>
            <p>{t("adminDnsStep6")}</p>
          </div>
        </CardContent>
      </Card>

      {/* Add Domain */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminAddDomain")}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              placeholder={t("domainPlaceholder")}
              className="max-w-md"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
            />
            <Button onClick={handleAdd} disabled={adding || !newDomain.trim()}>
              <Plus className="mr-1 h-3 w-3" />
              {adding ? t("loading") : t("adminAddDomain")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Domains List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("adminDomainsTitle")}</CardTitle>
          <CardDescription>{domains.length} {t("totalAccounts").toLowerCase()}</CardDescription>
        </CardHeader>
        <CardContent>
          {domains.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">{t("adminNoDomains")}</p>
          ) : (
            <div className="space-y-3">
              {domains.map((domain) => (
                <div key={domain.id} className="rounded-md border border-border p-4">
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm font-semibold">{domain.domain}</span>
                        <Badge className="bg-purple-600">Global</Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {domain.verified ? (
                          <Badge className="bg-green-600 flex items-center gap-1">
                            <CheckCircle className="h-3 w-3" />
                            {t("domainVerified")}
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <XCircle className="h-3 w-3" />
                            {t("domainPending")}
                          </Badge>
                        )}
                        {domain.sslActive && (
                          <Badge className="bg-blue-600 flex items-center gap-1">
                            <Shield className="h-3 w-3" />
                            {t("domainSslActive")}
                          </Badge>
                        )}
                        {domain.verified && domain.sslActive && (
                          <Badge variant="outline" className="text-green-500">
                            {t("domainReady")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        A Record: {serverIp} | CNAME: {platformDomain}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!domain.verified && (
                        <Button variant="outline" size="sm" onClick={() => handleVerify(domain.id)} disabled={verifyingId === domain.id}>
                          <RefreshCw className={`mr-1 h-3 w-3 ${verifyingId === domain.id ? "animate-spin" : ""}`} />
                          {verifyingId === domain.id ? t("domainVerifying") : t("domainVerify")}
                        </Button>
                      )}
                      {domain.verified && !domain.sslActive && (
                        <Button size="sm" onClick={() => handleProvision(domain.id)} disabled={provisioningId === domain.id}>
                          <Shield className="mr-1 h-3 w-3" />
                          {provisioningId === domain.id ? t("domainProvisioning") : t("domainProvisionSsl")}
                        </Button>
                      )}
                      {domain.verified && domain.sslActive && (
                        <Button variant="outline" size="sm" onClick={() => handlePing(domain)} disabled={pingingId === domain.id}>
                          <Globe className={`mr-1 h-3 w-3 ${pingingId === domain.id ? "animate-spin" : ""}`} />
                          Ping
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(domain.id)}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
