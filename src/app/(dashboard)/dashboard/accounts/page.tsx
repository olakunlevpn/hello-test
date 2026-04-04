"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";
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
  Info,
  Trash2,
  Mail,
  Paperclip,
  Flag,
  ChevronDown,
  ChevronUp,
  ExternalLink,
} from "lucide-react";
import { t } from "@/i18n";
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
  createdAt: string;
}

interface EmailMessage {
  id: string;
  subject: string;
  bodyPreview: string;
  body?: { contentType: string; content: string };
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  importance: string;
  hasAttachments: boolean;
}

export default function AccountsPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [emails, setEmails] = useState<EmailMessage[]>([]);
  const [emailsLoading, setEmailsLoading] = useState(false);
  const [selectedEmailIds, setSelectedEmailIds] = useState<Set<string>>(new Set());
  const [expandedEmailId, setExpandedEmailId] = useState<string | null>(null);
  const [expandedBody, setExpandedBody] = useState<string | null>(null);
  const [expandedAttachments, setExpandedAttachments] = useState<{ id: string; name: string; contentType: string; size: number; contentBytes?: string }[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [topCount, setTopCount] = useState("20");
  const [filterType, setFilterType] = useState("all");

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

  const loadEmails = useCallback(async (accountId: string, top: string, filter: string) => {
    setEmailsLoading(true);
    setSelectedEmailIds(new Set());
    setExpandedEmailId(null);
    setExpandedBody(null);
    try {
      // Fetch more when filtering client-side so we get enough results
      const fetchCount = filter !== "all" ? "100" : top;
      const params = new URLSearchParams({
        accountId,
        top: fetchCount,
        orderby: "receivedDateTime desc",
      });

      const res = await fetch(`/api/mail?${params}`);
      if (res.ok) {
        const data = await res.json();
        let results: EmailMessage[] = data.value || [];

        // Client-side filter
        if (filter === "unread") results = results.filter((e) => !e.isRead);
        else if (filter === "attachments") results = results.filter((e) => e.hasAttachments);
        else if (filter === "important") results = results.filter((e) => e.importance === "high");

        // Limit to requested count
        setEmails(results.slice(0, parseInt(top)));
      } else {
        setEmails([]);
      }
    } catch {
      setEmails([]);
    } finally {
      setEmailsLoading(false);
    }
  }, []);

  const isAccountActive = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.status === "ACTIVE";
  };

  const handleAccountSelect = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (!isAccountActive(accountId)) return;
    loadEmails(accountId, topCount, filterType);
  };

  const handleFilterChange = (newFilter: string) => {
    setFilterType(newFilter);
    if (selectedAccountId) loadEmails(selectedAccountId, topCount, newFilter);
  };

  const handleTopCountChange = (newTop: string) => {
    setTopCount(newTop);
    if (selectedAccountId) loadEmails(selectedAccountId, newTop, filterType);
  };

  const handleExpandEmail = async (email: EmailMessage) => {
    if (expandedEmailId === email.id) {
      setExpandedEmailId(null);
      setExpandedBody(null);
      setExpandedAttachments([]);
      return;
    }
    setExpandedEmailId(email.id);
    setExpandedBody(null);
    setExpandedAttachments([]);
    try {
      const res = await fetch(`/api/mail/${email.id}?accountId=${selectedAccountId}`);
      if (res.ok) {
        const fullMsg = await res.json();
        setExpandedBody(fullMsg.body?.content || fullMsg.bodyPreview || "");

        if (fullMsg.hasAttachments) {
          try {
            const attRes = await fetch(`/api/mail/${email.id}/attachments?accountId=${selectedAccountId}`);
            if (attRes.ok) {
              const attData = await attRes.json();
              setExpandedAttachments(attData.value || []);
            }
          } catch { /* ignore */ }
        }
      }
    } catch {
      setExpandedBody(email.bodyPreview);
    }
  };

  const handlePreviewAttachment = async (emailId: string, attId: string) => {
    try {
      const res = await fetch(`/api/mail/${emailId}/attachments/${attId}?accountId=${selectedAccountId}`);
      if (!res.ok) return;
      const att = await res.json();
      if (att.contentBytes) {
        const byteCharacters = atob(att.contentBytes);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: att.contentType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);

        // Images and PDFs: open in new tab for preview
        if (att.contentType?.startsWith("image/") || att.contentType === "application/pdf") {
          window.open(url, "_blank");
        } else {
          // Other files: download
          const a = document.createElement("a");
          a.href = url;
          a.download = att.name || "attachment";
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
      }
    } catch { /* ignore */ }
  };

  const toggleSelect = (emailId: string) => {
    setSelectedEmailIds((prev) => {
      const next = new Set(prev);
      if (next.has(emailId)) next.delete(emailId);
      else next.add(emailId);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedEmailIds.size === emails.length) {
      setSelectedEmailIds(new Set());
    } else {
      setSelectedEmailIds(new Set(emails.map((e) => e.id)));
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedEmailIds.size === 0 || !selectedAccountId) return;
    if (!confirm(t("deleteSelectedConfirm", { count: String(selectedEmailIds.size) }))) return;

    setDeleting(true);
    const idsToDelete = Array.from(selectedEmailIds);
    let deletedCount = 0;

    for (const id of idsToDelete) {
      try {
        const res = await fetch(`/api/mail/${id}?accountId=${selectedAccountId}`, { method: "DELETE" });
        if (res.ok) deletedCount++;
      } catch {
        // continue with next
      }
    }

    if (deletedCount > 0) {
      setEmails((prev) => prev.filter((e) => !selectedEmailIds.has(e.id)));
      setSelectedEmailIds(new Set());
      if (expandedEmailId && selectedEmailIds.has(expandedEmailId)) {
        setExpandedEmailId(null);
        setExpandedBody(null);
      }
    }
    setDeleting(false);
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("accounts")}</h1>

      {/* Connect info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            {t("connectNewAccount")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{t("contactAdminForToken")}</p>
        </CardContent>
      </Card>

      {/* Account selector */}
      <Card>
        <CardHeader>
          <CardTitle>{t("connectedAccounts")}</CardTitle>
          <CardDescription>
            {accounts.length} {t("totalAccounts").toLowerCase()}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-md font-semibold">{t("noAccountsTitle")}</h3>
              <p className="text-sm text-muted-foreground text-center max-w-sm">{t("noAccountsDescription")}</p>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/dashboard/invitations"}>
                {t("invitations")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Select
                value={selectedAccountId}
                onValueChange={(v) => v && handleAccountSelect(v)}
              >
                <SelectTrigger className="w-full max-w-md">
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>
                    {t("selectAccount")}
                  </SelectItem>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span>{account.displayName}</span>
                        <span className="text-muted-foreground">({account.email})</span>
                        {account.status === "ACTIVE" ? (
                          <Badge className="bg-green-600 ml-1">{t("statusActive")}</Badge>
                        ) : (
                          <Badge variant="destructive" className="ml-1">{t("statusNeedsReauth")}</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAccountId && isAccountActive(selectedAccountId) && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/email/${selectedAccountId}`, "_blank")}
                >
                  <ExternalLink className="mr-1 h-3 w-3" />
                  {t("openOutlook")}
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Emails list */}
      {selectedAccountId && !isAccountActive(selectedAccountId) && (
        <Card>
          <CardContent className="py-6 text-center">
            <p className="text-sm text-destructive">{t("accountNotActive")}</p>
          </CardContent>
        </Card>
      )}

      {selectedAccountId && isAccountActive(selectedAccountId) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Mail className="h-5 w-5" />
                  {t("recentEmails")}
                </CardTitle>
                {selectedAccount && (
                  <CardDescription>{selectedAccount.email}</CardDescription>
                )}
              </div>
              <div className="flex items-center gap-2">
                {selectedEmailIds.size > 0 && (
                  <>
                    <span className="text-sm text-muted-foreground">
                      {t("selectedCount", { count: String(selectedEmailIds.size) })}
                    </span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleDeleteSelected}
                      disabled={deleting}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      {deleting ? t("loading") : t("deleteSelected")}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Filters */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("showCount")}:</span>
                <Select value={topCount} onValueChange={(v) => v && handleTopCountChange(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-1">
                {[
                  { value: "all", label: t("filterAll") },
                  { value: "unread", label: t("filterUnread") },
                  { value: "attachments", label: t("filterWithAttachments") },
                  { value: "important", label: t("filterHighImportance") },
                ].map((f) => (
                  <Button
                    key={f.value}
                    variant={filterType === f.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleFilterChange(f.value)}
                    className="text-xs h-7"
                  >
                    {f.label}
                  </Button>
                ))}
              </div>
            </div>

            {emailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <LoadingText className="text-muted-foreground" />
              </div>
            ) : emails.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-muted-foreground">{t("noEmailsFound")}</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <input
                        type="checkbox"
                        checked={selectedEmailIds.size === emails.length && emails.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-input accent-primary"
                      />
                    </TableHead>
                    <TableHead className="w-10"></TableHead>
                    <TableHead>{t("from")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {emails.map((email) => (
                    <React.Fragment key={email.id}>
                      <TableRow
                        className={`cursor-pointer ${!email.isRead ? "font-semibold" : ""} ${selectedEmailIds.has(email.id) ? "bg-muted/50" : ""}`}
                      >
                        <TableCell onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedEmailIds.has(email.id)}
                            onChange={() => toggleSelect(email.id)}
                            className="h-4 w-4 rounded border-input accent-primary"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {!email.isRead && (
                              <div className="h-2 w-2 rounded-full bg-blue-500 mt-1" />
                            )}
                            {email.hasAttachments && (
                              <Paperclip className="h-3 w-3 text-muted-foreground" />
                            )}
                            {email.importance === "high" && (
                              <Flag className="h-3 w-3 text-red-500" />
                            )}
                          </div>
                        </TableCell>
                        <TableCell
                          className="max-w-[200px] truncate"
                          onClick={() => handleExpandEmail(email)}
                        >
                          {email.from?.emailAddress?.name || email.from?.emailAddress?.address || "—"}
                        </TableCell>
                        <TableCell
                          className="max-w-[300px] truncate"
                          onClick={() => handleExpandEmail(email)}
                        >
                          <div>
                            <span>{email.subject || "(no subject)"}</span>
                            <span className="ml-2 text-muted-foreground font-normal text-xs truncate">
                              {email.bodyPreview?.slice(0, 80)}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className="text-sm whitespace-nowrap"
                          onClick={() => handleExpandEmail(email)}
                        >
                          {new Date(email.receivedDateTime).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </TableCell>
                        <TableCell onClick={() => handleExpandEmail(email)}>
                          {expandedEmailId === email.id ? (
                            <ChevronUp className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          )}
                        </TableCell>
                      </TableRow>
                      {expandedEmailId === email.id && (
                        <TableRow>
                          <TableCell colSpan={6} className="p-0">
                            <div className="border-t bg-muted/30 p-4">
                              <div className="mb-2 text-xs text-muted-foreground">
                                {t("from")}: {email.from?.emailAddress?.name} &lt;{email.from?.emailAddress?.address}&gt;
                              </div>
                              <div className="mb-3 text-xs text-muted-foreground">
                                {t("subject")}: {email.subject || "(no subject)"}
                              </div>
                              {expandedBody ? (
                                <div
                                  className="prose prose-sm dark:prose-invert max-w-none text-sm"
                                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(expandedBody) }}
                                />
                              ) : (
                                <LoadingText className="text-muted-foreground text-sm" />
                              )}
                              {expandedAttachments.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border">
                                  <div className="text-xs font-semibold text-muted-foreground mb-2">
                                    {t("attachments")} ({expandedAttachments.length})
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    {expandedAttachments.map((att) => {
                                      const isImage = att.contentType?.startsWith("image/");
                                      const isPdf = att.contentType === "application/pdf";
                                      const sizeKb = Math.round((att.size || 0) / 1024);
                                      return (
                                        <button
                                          key={att.id}
                                          onClick={() => handlePreviewAttachment(email.id, att.id)}
                                          className="flex items-center gap-2 rounded border border-border bg-muted/50 px-3 py-2 text-xs hover:bg-muted transition-colors cursor-pointer"
                                        >
                                          <Paperclip className="h-3 w-3 text-muted-foreground" />
                                          <span className="truncate max-w-[150px]">{att.name}</span>
                                          <span className="text-muted-foreground">{sizeKb}KB</span>
                                          {(isImage || isPdf) && (
                                            <Badge variant="outline" className="text-[10px] px-1 py-0">
                                              {isImage ? t("preview") : "PDF"}
                                            </Badge>
                                          )}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
