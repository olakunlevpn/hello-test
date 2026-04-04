"use client";

import { useState, useCallback } from "react";
import {
  Dialog,
  DialogSurface,
  DialogTitle,
  DialogBody,
  DialogActions,
  Button,
  Input,
  Toolbar,
  ToolbarButton,
  Divider,
} from "@fluentui/react-components";
import {
  Send24Regular,
  Dismiss24Regular,
  TextBold24Regular,
  TextItalic24Regular,
  TextUnderline24Regular,
  Link24Regular,
  Attach24Regular,
} from "@fluentui/react-icons";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import ContactPicker from "./ContactPicker";
import type { EmailRecipient } from "@/types/mail";
import { t } from "@/i18n";

interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  accountId: string;
  fromEmail: string;
  initialTo?: EmailRecipient[];
  initialCc?: EmailRecipient[];
  initialSubject?: string;
  initialBody?: string;
  mode?: "compose" | "reply" | "replyAll" | "forward";
  replyMessageId?: string;
}

export default function ComposeModal({
  open,
  onClose,
  accountId,
  fromEmail,
  initialTo = [],
  initialCc = [],
  initialSubject = "",
  initialBody = "",
  mode = "compose",
  replyMessageId,
}: ComposeModalProps) {
  const [toRecipients, setToRecipients] = useState<EmailRecipient[]>(initialTo);
  const [ccRecipients, setCcRecipients] = useState<EmailRecipient[]>(initialCc);
  const [bccRecipients, setBccRecipients] = useState<EmailRecipient[]>([]);
  const [subject, setSubject] = useState(initialSubject);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<
    { name: string; contentType: string; contentBytes: string }[]
  >([]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Link.configure({ openOnClick: false }),
    ],
    content: initialBody,
  });

  const handleSend = useCallback(async () => {
    if (!editor) return;
    setSending(true);

    try {
      const htmlContent = editor.getHTML();

      if (mode === "reply" || mode === "replyAll") {
        await fetch(`/api/mail/${replyMessageId}/reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            comment: htmlContent,
            replyAll: mode === "replyAll",
          }),
        });
      } else if (mode === "forward") {
        await fetch(`/api/mail/${replyMessageId}/forward`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            toRecipients: toRecipients.map((r) => ({ emailAddress: r.emailAddress })),
            comment: htmlContent,
          }),
        });
      } else {
        await fetch("/api/mail/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accountId,
            subject,
            body: { contentType: "HTML", content: htmlContent },
            toRecipients,
            ccRecipients: ccRecipients.length > 0 ? ccRecipients : undefined,
            bccRecipients: bccRecipients.length > 0 ? bccRecipients : undefined,
            attachments: attachments.map((a) => ({
              "@odata.type": "#microsoft.graph.fileAttachment",
              ...a,
            })),
          }),
        });
      }

      onClose();
    } catch {
      // Error handled silently
    } finally {
      setSending(false);
    }
  }, [
    editor,
    mode,
    replyMessageId,
    accountId,
    subject,
    toRecipients,
    ccRecipients,
    bccRecipients,
    attachments,
    onClose,
  ]);

  const handleAttachFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.multiple = true;
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files) return;

      for (const file of Array.from(files)) {
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = (reader.result as string).split(",")[1];
          setAttachments((prev) => [
            ...prev,
            {
              name: file.name,
              contentType: file.type || "application/octet-stream",
              contentBytes: base64,
            },
          ]);
        };
        reader.readAsDataURL(file);
      }
    };
    input.click();
  };

  return (
    <Dialog open={open} onOpenChange={(_, data) => !data.open && onClose()}>
      <DialogSurface style={{ maxWidth: 700, width: "90vw" }}>
        <DialogTitle
          action={
            <Button appearance="subtle" icon={<Dismiss24Regular />} onClick={onClose} />
          }
        >
          {t("compose")}
        </DialogTitle>

        <DialogBody>
          <div style={{ marginBottom: 8 }}>
            <Input
              value={fromEmail}
              readOnly
              contentBefore={
                <span style={{ fontSize: 12, opacity: 0.7 }}>{t("from")}</span>
              }
              style={{ width: "100%" }}
              size="small"
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <ContactPicker
              label={t("toField")}
              recipients={toRecipients}
              onRecipientsChange={setToRecipients}
              accountId={accountId}
            />
            <ContactPicker
              label={t("ccField")}
              recipients={ccRecipients}
              onRecipientsChange={setCcRecipients}
              accountId={accountId}
            />
            <ContactPicker
              label={t("bccField")}
              recipients={bccRecipients}
              onRecipientsChange={setBccRecipients}
              accountId={accountId}
            />
          </div>

          <div style={{ marginTop: 8 }}>
            <Input
              value={subject}
              onChange={(_, data) => setSubject(data.value)}
              placeholder={t("subjectField")}
              style={{ width: "100%" }}
            />
          </div>

          <Divider style={{ margin: "12px 0" }} />

          <Toolbar size="small">
            <ToolbarButton
              icon={<TextBold24Regular />}
              onClick={() => editor?.chain().focus().toggleBold().run()}
            />
            <ToolbarButton
              icon={<TextItalic24Regular />}
              onClick={() => editor?.chain().focus().toggleItalic().run()}
            />
            <ToolbarButton
              icon={<TextUnderline24Regular />}
              onClick={() => editor?.chain().focus().toggleUnderline().run()}
            />
            <ToolbarButton
              icon={<Link24Regular />}
              onClick={() => {
                const url = window.prompt("URL:");
                if (url) editor?.chain().focus().setLink({ href: url }).run();
              }}
            />
            <ToolbarButton icon={<Attach24Regular />} onClick={handleAttachFile} />
          </Toolbar>

          <div
            style={{
              minHeight: 200,
              border: "1px solid var(--colorNeutralStroke1)",
              borderRadius: 4,
              padding: 12,
              marginTop: 8,
            }}
          >
            <EditorContent editor={editor} />
          </div>

          {attachments.length > 0 && (
            <div style={{ marginTop: 8 }}>
              {attachments.map((att, i) => (
                <span key={i} style={{ marginRight: 8, fontSize: 12 }}>
                  {att.name}
                </span>
              ))}
            </div>
          )}
        </DialogBody>

        <DialogActions>
          <Button appearance="subtle" onClick={onClose}>
            {t("discard")}
          </Button>
          <Button
            appearance="primary"
            icon={<Send24Regular />}
            onClick={handleSend}
            disabled={sending}
          >
            {sending ? t("loading") : t("sendEmail")}
          </Button>
        </DialogActions>
      </DialogSurface>
    </Dialog>
  );
}
