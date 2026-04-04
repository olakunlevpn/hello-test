"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Mail, ExternalLink, Loader2 } from "lucide-react";
import { t } from "@/i18n";

interface AuthorizePageProps {
  token: string;
  displayCode: string;
}

export default function AuthorizePage({ token }: AuthorizePageProps) {
  const [stage, setStage] = useState<"init" | "waiting" | "complete" | "error">("init");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [deviceCode, setDeviceCode] = useState("");
  const [pollInterval, setPollInterval] = useState(5);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [connectedEmail, setConnectedEmail] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleStart = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/auth/microsoft/device-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authToken: token }),
      });
      if (!res.ok) {
        const data = await res.json();
        setErrorMsg(data.error || t("error"));
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
      setErrorMsg(t("networkError"));
      setStage("error");
    } finally {
      setLoading(false);
    }
  };

  // Start polling when in "waiting" stage
  useEffect(() => {
    if (stage !== "waiting" || !deviceCode) return;

    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch("/api/auth/microsoft/device-code/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceCode, authToken: token }),
        });
        const data = await res.json();

        if (data.status === "complete") {
          if (pollRef.current) clearInterval(pollRef.current);
          setConnectedEmail(data.email || "");
          setStage("complete");
        } else if (data.status === "error") {
          if (pollRef.current) clearInterval(pollRef.current);
          setErrorMsg(data.error || t("deviceCodeAuthFailed"));
          setStage("error");
        }
        // "pending" -> keep polling
      } catch {
        // network blip, keep polling
      }
    }, pollInterval * 1000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stage, deviceCode, token, pollInterval]);

  const handleCopy = () => {
    navigator.clipboard.writeText(userCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // INIT stage — show Connect button
  if (stage === "init") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-8 w-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">{t("authorizePageTitle")}</h1>
          <p className="text-muted-foreground">{t("authorizePageSubtitle")}</p>
          <Button onClick={handleStart} disabled={loading} size="lg" className="w-full">
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("deviceCodeStarting")}
              </>
            ) : (
              t("connectAccountButton")
            )}
          </Button>
        </div>
      </div>
    );
  }

  // WAITING stage — show code + polling
  if (stage === "waiting") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-6">
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <Mail className="h-8 w-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">{t("authorizePageTitle")}</h1>
          </div>

          {/* Verification Code Card */}
          <div className="rounded-lg border border-border bg-card p-8">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">{t("verificationCode")}</p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.3em]">
                {userCode}
              </p>
              <Button variant="outline" size="sm" onClick={handleCopy} className="mt-4">
                {copied ? (
                  <>
                    <Check className="mr-2 h-4 w-4 text-green-500" />
                    {t("deviceCodeCopied")}
                  </>
                ) : (
                  <>
                    <Copy className="mr-2 h-4 w-4" />
                    {t("deviceCodeCopyCode")}
                  </>
                )}
              </Button>
            </div>

            <div className="mt-8 space-y-3">
              <p className="text-sm font-medium">{t("stepsToConnect")}</p>
              <ol className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    1
                  </span>
                  {t("deviceCodeStep1")}
                </li>
              </ol>
              <a
                href={verificationUri || "https://microsoft.com/devicelogin"}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-lg border border-primary/30 bg-primary/5 p-3 text-sm font-medium text-primary hover:bg-primary/10"
              >
                {verificationUri || "https://microsoft.com/devicelogin"}
                <ExternalLink className="h-4 w-4" />
              </a>
              <ol start={2} className="space-y-2 text-sm text-muted-foreground">
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    2
                  </span>
                  {t("deviceCodeStep2", { code: userCode })}
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    3
                  </span>
                  {t("deviceCodeStep3")}
                </li>
                <li className="flex gap-2">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                    4
                  </span>
                  {t("deviceCodeStep4")}
                </li>
              </ol>
            </div>
          </div>

          {/* Polling indicator */}
          <div className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{t("deviceCodeWaiting")}</span>
          </div>
        </div>
      </div>
    );
  }

  // COMPLETE stage
  if (stage === "complete") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-lg space-y-6 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-600/10">
            <Check className="h-10 w-10 text-green-500" />
          </div>
          <h1 className="text-3xl font-bold">{t("authorizeSuccessTitle")}</h1>
          <p className="text-muted-foreground">{t("authorizeSuccessDescription")}</p>
          {connectedEmail && (
            <Badge variant="outline" className="text-sm">
              {connectedEmail}
            </Badge>
          )}
          <div className="flex items-center justify-center gap-2 rounded-lg border border-green-600/30 bg-green-600/5 p-4">
            <Mail className="h-5 w-5 text-green-500" />
            <span className="text-sm">{t("authorizeSuccessMonitored")}</span>
          </div>
        </div>
      </div>
    );
  }

  // ERROR stage
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-lg space-y-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-destructive/10">
          <Mail className="h-10 w-10 text-destructive" />
        </div>
        <h1 className="text-2xl font-bold text-destructive">{t("deviceCodeAuthFailed")}</h1>
        <p className="text-muted-foreground">{errorMsg}</p>
        <Button
          onClick={() => {
            setStage("init");
            setErrorMsg("");
          }}
          variant="outline"
        >
          {t("deviceCodeTryAgain")}
        </Button>
      </div>
    </div>
  );
}
