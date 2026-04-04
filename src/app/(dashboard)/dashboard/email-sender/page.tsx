"use client";

import React, { useEffect, useState, useRef } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
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
  Send,
  Mail,
  Eye,
  Upload,
  Paperclip,
  X,
  Link as LinkIcon,
} from "lucide-react";
import { t } from "@/i18n";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface AttachmentFile {
  name: string;
  contentType: string;
  contentBytes: string;
}

export default function EmailSenderPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [toField, setToField] = useState("");
  const [ccField, setCcField] = useState("");
  const [bccField, setBccField] = useState("");
  const [replyToField, setReplyToField] = useState("");
  const [subject, setSubject] = useState("");
  const [invitationUrl, setInvitationUrl] = useState("");
  const [body, setBody] = useState("");
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [sending, setSending] = useState(false);
  const [bulkSending, setBulkSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sendProgress, setSendProgress] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bulkFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {});
  }, [status]);

  const showMessage = (text: string, type: "success" | "error") => {
    if (type === "success") toast.success(text);
    else toast.error(text);
  };

  const selectedAccount = accounts.find((a) => a.id === selectedAccountId);

  const parseEmails = (input: string): string[] => {
    return input
      .split(/[,;\n]+/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));
  };

  const replaceTokens = (template: string, recipientEmail: string) => {
    const namePart = recipientEmail.split("@")[0].replace(/[._-]/g, " ");
    const nameCapitalized = namePart.replace(/\b\w/g, (c) => c.toUpperCase());
    const domainPart = recipientEmail.split("@")[1] || "";
    const companyName = domainPart.split(".")[0]?.replace(/\b\w/g, (c) => c.toUpperCase()) || "";
    const initial = nameCapitalized.charAt(0);
    const senderEmail = selectedAccount?.email || "";

    return template
      .replace(/\[\[name\]\]/gi, nameCapitalized)
      .replace(/\[\[email\]\]/gi, recipientEmail)
      .replace(/\[\[company\]\]/gi, companyName)
      .replace(/\[\[date\]\]/gi, new Date().toLocaleDateString())
      .replace(/\[\[link\]\]/gi, invitationUrl)
      .replace(/\[\[name_initial\]\]/gi, initial)
      .replace(/\[\[sender_email\]\]/gi, senderEmail);
  };

  const buildPayload = (toEmails: string[]) => {
    const toRecipients = toEmails.map((email) => ({
      emailAddress: { address: email, name: "" },
    }));
    const ccRecipients = parseEmails(ccField).map((email) => ({
      emailAddress: { address: email, name: "" },
    }));
    const bccRecipients = parseEmails(bccField).map((email) => ({
      emailAddress: { address: email, name: "" },
    }));
    const replyTo = replyToField.trim()
      ? [{ emailAddress: { address: replyToField.trim(), name: "" } }]
      : undefined;

    return {
      accountId: selectedAccountId,
      subject,
      body: { contentType: "HTML" as const, content: body },
      toRecipients,
      ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
      bccRecipients: bccRecipients.length > 0 ? bccRecipients : undefined,
      replyTo,
      attachments: attachments.length > 0
        ? attachments.map((a) => ({
            "@odata.type": "#microsoft.graph.fileAttachment" as const,
            name: a.name,
            contentType: a.contentType,
            contentBytes: a.contentBytes,
          }))
        : undefined,
    };
  };

  const isAccountActive = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.status === "ACTIVE";
  };

  const handleSend = async () => {
    if (!selectedAccountId) { showMessage(t("senderNoAccount"), "error"); return; }
    if (!isAccountActive(selectedAccountId)) { showMessage(t("accountNotActive"), "error"); return; }
    const toEmails = parseEmails(toField);
    if (toEmails.length === 0) return;

    setSending(true);
    try {
      const payload = buildPayload(toEmails);
      // Replace tokens in subject and body for single send (use first recipient)
      payload.subject = replaceTokens(subject, toEmails[0]);
      payload.body.content = replaceTokens(body, toEmails[0]);

      const res = await fetch("/api/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showMessage(t("senderSent"), "success");
      } else {
        showMessage(t("senderSendFailed"), "error");
      }
    } catch {
      showMessage(t("senderSendFailed"), "error");
    } finally {
      setSending(false);
    }
  };

  const handleBulkSend = async () => {
    if (!selectedAccountId) { showMessage(t("senderNoAccount"), "error"); return; }
    if (!isAccountActive(selectedAccountId)) { showMessage(t("accountNotActive"), "error"); return; }
    if (!bulkFileRef.current?.files?.[0]) return;

    const file = bulkFileRef.current.files[0];
    const text = await file.text();
    const recipients = text
      .split(/[\n,;]+/)
      .map((e) => e.trim())
      .filter((e) => e && e.includes("@"));

    if (recipients.length === 0) return;

    setBulkSending(true);
    let sentCount = 0;

    for (let i = 0; i < recipients.length; i++) {
      const email = recipients[i];
      setSendProgress(`${i + 1}/${recipients.length}`);

      try {
        const payload = buildPayload([email]);
        payload.subject = replaceTokens(subject, email);
        payload.body.content = replaceTokens(body, email);

        const res = await fetch("/api/mail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (res.ok) sentCount++;
      } catch {
        // continue with next
      }
    }

    showMessage(t("senderBulkSent", { count: String(sentCount) }), "success");
    setBulkSending(false);
    setSendProgress("");
    if (bulkFileRef.current) bulkFileRef.current.value = "";
  };

  const handleFileAttach = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newAttachments: AttachmentFile[] = [];
    for (const file of Array.from(files)) {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      newAttachments.push({
        name: file.name,
        contentType: file.type || "application/octet-stream",
        contentBytes: base64,
      });
    }
    setAttachments((prev) => [...prev, ...newAttachments]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const getPreviewHtml = () => {
    const sampleEmail = parseEmails(toField)[0] || "john.doe@company.com";
    return replaceTokens(body, sampleEmail);
  };

  const inputClass = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring";

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Send className="h-7 w-7" />
        {t("emailSender")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("emailSender")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Account selector */}
          <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={t("selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" disabled>{t("selectAccount")}</SelectItem>
              {accounts.filter((a) => a.status === "ACTIVE").map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3 w-3" />
                    {a.email}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* To */}
          <Input
            value={toField}
            onChange={(e) => setToField(e.target.value)}
            placeholder={t("senderTo")}
          />

          {/* CC */}
          <Input
            value={ccField}
            onChange={(e) => setCcField(e.target.value)}
            placeholder={t("senderCc")}
          />

          {/* BCC */}
          <Input
            value={bccField}
            onChange={(e) => setBccField(e.target.value)}
            placeholder={t("senderBcc")}
          />

          {/* Reply-To */}
          <Input
            value={replyToField}
            onChange={(e) => setReplyToField(e.target.value)}
            placeholder={t("senderReplyTo")}
          />

          {/* Subject */}
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={t("senderSubject")}
          />

          {/* Invitation URL */}
          <div className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-primary flex-shrink-0" />
            <Label className="text-sm font-semibold flex-shrink-0">{t("senderInvitationUrl")}:</Label>
            <Input
              value={invitationUrl}
              onChange={(e) => setInvitationUrl(e.target.value)}
              placeholder={t("senderInvitationUrlPlaceholder")}
              className="flex-1"
            />
          </div>

          {/* Tokens hint + Preview */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs text-muted-foreground">
              <span className="mr-1">Tokens:</span>
              {["[[name]]", "[[email]]", "[[company]]", "[[date]]", "[[link]]", "[[name_initial]]", "[[sender_email]]"].map((token) => (
                <Badge key={token} variant="secondary" className="mr-1 mb-1 text-[10px] font-mono">
                  {token}
                </Badge>
              ))}
              <span className="text-muted-foreground">— {t("senderTokensHint")}</span>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPreviewOpen(!previewOpen)}>
              <Eye className="mr-1 h-3 w-3" />
              {t("senderPreview")}
            </Button>
          </div>

          {/* Preview */}
          {previewOpen && (
            <div className="rounded-md border border-border bg-muted/30 p-4">
              <div className="text-xs font-semibold text-muted-foreground mb-2">{t("senderPreview")}</div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(getPreviewHtml()) }}
              />
            </div>
          )}

          {/* Body */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={t("senderBody")}
            rows={12}
            className={`${inputClass} font-mono resize-vertical`}
          />

          {/* Attachments */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Label className="text-sm">{t("senderAttachments")}:</Label>
              <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Paperclip className="mr-1 h-3 w-3" />
                {t("senderChooseFiles")}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileAttach}
                className="hidden"
              />
            </div>
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {attachments.map((att, idx) => (
                  <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                    <Paperclip className="h-3 w-3" />
                    {att.name}
                    <button onClick={() => removeAttachment(idx)} className="ml-1 hover:text-destructive">
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {/* Bulk file */}
          <div className="flex items-center gap-2">
            <Label className="text-sm">{t("senderBulkFile")}:</Label>
            <input
              ref={bulkFileRef}
              type="file"
              accept=".txt,.csv"
              className="text-sm text-muted-foreground file:mr-2 file:rounded file:border-0 file:bg-muted file:px-3 file:py-1 file:text-xs file:font-medium"
            />
            <span className="text-xs text-muted-foreground">{t("senderBulkHint")}</span>
          </div>

          {/* Send buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              variant="destructive"
              onClick={handleSend}
              disabled={sending || bulkSending || !selectedAccountId}
            >
              {sending ? t("senderSending") : t("senderSend")}
            </Button>
            <Button
              variant="outline"
              onClick={handleBulkSend}
              disabled={sending || bulkSending || !selectedAccountId}
            >
              <Upload className="mr-1 h-3 w-3" />
              {bulkSending ? `${t("senderSending")} ${sendProgress}` : t("senderSendBulk")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
