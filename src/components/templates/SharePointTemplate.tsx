"use client";

import { Loader2 } from "lucide-react";

interface TemplateProps {
  documentTitle: string;
  docType: string;
  senderName: string;
  onConnect: () => void;
  connecting: boolean;
}

function DocIcon({ docType }: { docType: string }) {
  const colors: Record<string, string> = {
    PDF: "#E74C3C",
    DOCX: "#2B579A",
    XLSX: "#217346",
    PPTX: "#D24726",
    ZIP: "#F0AD4E",
  };
  const color = colors[docType] || "#038387";
  return (
    <div
      style={{
        width: 48,
        height: 56,
        borderRadius: 4,
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#fff",
        fontSize: 12,
        fontWeight: 700,
      }}
    >
      {docType}
    </div>
  );
}

export default function SharePointTemplate({
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
          padding: "16px 24px",
          backgroundColor: "#038387",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="8" r="6" fill="#fff" opacity="0.9" />
          <circle cx="7" cy="14" r="5" fill="#fff" opacity="0.7" />
          <circle cx="17" cy="16" r="4" fill="#fff" opacity="0.5" />
        </svg>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>SharePoint</span>
      </div>

      {/* Breadcrumb */}
      <div
        style={{
          width: "100%",
          maxWidth: 720,
          padding: "12px 24px",
        }}
      >
        <span style={{ color: "#808080", fontSize: 12 }}>
          Documents &gt; Shared &gt; {documentTitle}
        </span>
      </div>

      {/* Content */}
      <div
        style={{
          maxWidth: 720,
          width: "100%",
          padding: "0 24px",
        }}
      >
        <div
          style={{
            backgroundColor: "#2d2d2d",
            borderRadius: 8,
            padding: 32,
            border: "1px solid #404040",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: "50%",
                backgroundColor: "#038387",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <p style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 500 }}>{senderName}</p>
              <p style={{ color: "#808080", fontSize: 11 }}>
                Shared this document with you
              </p>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "20px 0",
              borderTop: "1px solid #404040",
              borderBottom: "1px solid #404040",
              margin: "16px 0 24px",
            }}
          >
            <DocIcon docType={docType} />
            <div>
              <p style={{ color: "#e0e0e0", fontSize: 16, fontWeight: 600 }}>
                {documentTitle}
              </p>
              <p style={{ color: "#808080", fontSize: 12, marginTop: 4 }}>
                {docType} &middot; Modified {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

          <button
            onClick={onConnect}
            disabled={connecting}
            style={{
              width: "100%",
              padding: "12px 24px",
              backgroundColor: connecting ? "#026d6f" : "#038387",
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
            {connecting ? "Opening..." : "Open in SharePoint"}
          </button>
        </div>
      </div>
    </div>
  );
}
