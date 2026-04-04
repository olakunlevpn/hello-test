"use client";

import {
  Text,
  Avatar,
  Divider,
} from "@fluentui/react-components";
import {
  MailRead20Regular,
  ArrowDownload20Regular,
} from "@fluentui/react-icons";
import type { EmailMessage, EmailAttachment } from "@/types/mail";
import { t } from "@/i18n";

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("en", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "pdf": return "📄";
    case "doc": case "docx": return "📝";
    case "xls": case "xlsx": return "📊";
    case "ppt": case "pptx": return "📎";
    case "jpg": case "jpeg": case "png": case "gif": return "🖼️";
    case "zip": case "rar": return "📦";
    default: return "📎";
  }
}

interface ReadingPaneProps {
  message: EmailMessage | null;
  attachments: EmailAttachment[];
  onDownloadAttachment: (attachmentId: string) => void;
}

export default function ReadingPane({
  message,
  attachments,
  onDownloadAttachment,
}: ReadingPaneProps) {
  if (!message) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "100%",
          gap: 8,
        }}
      >
        <MailRead20Regular style={{ fontSize: 48, color: "#c4c4c4" }} />
        <Text size={400} weight="semibold" style={{ color: "#616161" }}>
          {t("selectMessage")}
        </Text>
        <Text size={300} style={{ color: "#a0a0a0" }}>
          {t("nothingSelected")}
        </Text>
      </div>
    );
  }

  const senderName =
    message.from?.emailAddress?.name || message.from?.emailAddress?.address || "";
  const senderEmail = message.from?.emailAddress?.address || "";

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#f5f5f5" }}>
      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {/* White card */}
        <div style={{
          backgroundColor: "#ffffff",
          border: 0,
          borderRadius: 4,
          boxShadow: "0 0 2px rgba(0,0,0,0.12), 0 2px 4px rgba(0,0,0,0.14)",
          margin: "2px 2px 8px",
          padding: "6px 12px 12px",
        }}>
          {/* Subject */}
          <div style={{ padding: "16px 12px 12px" }}>
            <Text
              size={500}
              weight="semibold"
              block
              style={{ lineHeight: 1.3, color: "#242424" }}
            >
              {message.subject || "(no subject)"}
            </Text>
          </div>

          {/* Sender row */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "0 12px 12px" }}>
            <Avatar
              name={senderName}
              size={40}
              color="colorful"
              style={{ flexShrink: 0, marginTop: 2 }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <Text weight="semibold" size={300} style={{ color: "#242424" }}>
                  {senderName}
                </Text>
                <Text size={200} style={{ color: "#616161" }}>
                  &lt;{senderEmail}&gt;
                </Text>
              </div>

              {/* Recipients */}
              <div style={{ marginTop: 4 }}>
                <Text size={200} style={{ color: "#616161" }}>
                  {t("to")}:{" "}
                  {message.toRecipients
                    ?.map((r) => r.emailAddress?.name || r.emailAddress?.address)
                    .join(", ")}
                </Text>
                {message.ccRecipients && message.ccRecipients.length > 0 && (
                  <Text size={200} block style={{ color: "#616161", marginTop: 2 }}>
                    {t("cc")}:{" "}
                    {message.ccRecipients
                      .map((r) => r.emailAddress?.name || r.emailAddress?.address)
                      .join(", ")}
                  </Text>
                )}
              </div>
            </div>

            {/* Date -- right aligned */}
            <Text
              size={200}
              style={{
                color: "#616161",
                flexShrink: 0,
                whiteSpace: "nowrap",
              }}
            >
              {formatShortDate(message.receivedDateTime)}
            </Text>
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div style={{ padding: "0 12px 12px" }}>
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  flexWrap: "wrap",
                }}
              >
                {attachments.map((att) => (
                  <button
                    key={att.id}
                    onClick={() => onDownloadAttachment(att.id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "8px 12px",
                      background: "#f5f5f5",
                      border: "1px solid #e0e0e0",
                      borderRadius: 6,
                      cursor: "pointer",
                      color: "#242424",
                      fontSize: 12,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{getFileIcon(att.name)}</span>
                    <div style={{ textAlign: "left" }}>
                      <div style={{ fontWeight: 500 }}>{att.name}</div>
                      <div style={{ color: "#616161", fontSize: 11 }}>
                        {att.size < 1024 ? `${att.size} B` : att.size < 1048576 ? `${Math.round(att.size / 1024)} KB` : `${(att.size / 1048576).toFixed(1)} MB`}
                      </div>
                    </div>
                    <ArrowDownload20Regular style={{ color: "#616161", marginLeft: 4 }} />
                  </button>
                ))}
              </div>
            </div>
          )}

          <Divider style={{ margin: "0 12px" }} />

          {/* Email body */}
          <div style={{ padding: "0 12px 12px" }}>
            <iframe
              srcDoc={message.body?.content || ""}
              sandbox="allow-same-origin"
              style={{
                width: "100%",
                minHeight: 400,
                height: "calc(100vh - 340px)",
                border: "none",
                backgroundColor: "#ffffff",
                marginTop: 12,
                borderRadius: 4,
              }}
              title="Email content"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
