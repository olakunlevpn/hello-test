"use client";

import { Loader2 } from "lucide-react";

interface TemplateProps {
  documentTitle: string;
  docType: string;
  senderName: string;
  onConnect: () => void;
  connecting: boolean;
}

export default function GoogleDriveTemplate({
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
        backgroundColor: "#1a1a2e",
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
          backgroundColor: "#1e293b",
          borderBottom: "1px solid #334155",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M8 4L14 4L20 14H14L8 4Z" fill="#4285F4" opacity="0.9" />
          <path d="M2 14L8 4L14 14H8L2 14Z" fill="#FBBC04" opacity="0.9" />
          <path d="M8 14H20L17 20H5L8 14Z" fill="#34A853" opacity="0.9" />
        </svg>
        <span style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600 }}>Google Drive</span>
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
            backgroundColor: "#1e293b",
            borderRadius: 12,
            padding: 32,
            border: "1px solid #334155",
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <p style={{ color: "#94a3b8", fontSize: 13 }}>
              {senderName} shared a file
            </p>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: 16,
              backgroundColor: "#0f172a",
              borderRadius: 8,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                width: 48,
                height: 56,
                borderRadius: 4,
                backgroundColor:
                  docType === "PDF"
                    ? "#EA4335"
                    : docType === "DOCX"
                      ? "#4285F4"
                      : docType === "XLSX"
                        ? "#34A853"
                        : docType === "PPTX"
                          ? "#FBBC04"
                          : "#5f6368",
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
              <p style={{ color: "#e2e8f0", fontSize: 15, fontWeight: 600 }}>
                {documentTitle}
              </p>
              <p style={{ color: "#64748b", fontSize: 12, marginTop: 4 }}>
                Google Drive &middot; {docType} &middot; {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={onConnect}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "12px 24px",
              backgroundColor: connecting ? "#1d4ed8" : "#4285F4",
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
            {connecting ? "Opening..." : "Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
