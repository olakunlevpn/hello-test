"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Lock, Loader2 } from "lucide-react";
import { FluentProvider, webLightTheme } from "@fluentui/react-components";
import EmailLayout from "@/components/email/EmailLayout";
import Sidebar from "@/components/email/Sidebar";
import MessageList from "@/components/email/MessageList";
import ReadingPane from "@/components/email/ReadingPane";
import type { EmailMessage, MailFolder } from "@/types/mail";
import { t } from "@/i18n";

export default function SharedLinkPage() {
  const { code } = useParams<{ code: string }>();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [accountInfo, setAccountInfo] = useState<{ email: string; displayName: string } | null>(null);

  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState("inbox");
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const fetchShared = useCallback(async (endpoint: string, params?: Record<string, string>) => {
    const url = new URL(`/api/shared/${code}/${endpoint}`, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    if (!res.ok) throw new Error(`${res.status}`);
    return res.json();
  }, [code, sessionToken]);

  const handleUnlock = async () => {
    if (!password) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/shared/${code}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSessionToken(data.sessionToken);
        setAccountInfo({ email: data.email, displayName: data.displayName });
        setAuthenticated(true);
      } else {
        setError(data.error || t("wrongPassword"));
      }
    } catch {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authenticated || !sessionToken) return;
    fetchShared("folders")
      .then((data) => {
        const list = data.folders?.value || data.folders || data.value || [];
        setFolders(Array.isArray(list) ? list : []);
      })
      .catch(() => {});
  }, [authenticated, sessionToken, fetchShared]);

  useEffect(() => {
    if (!authenticated || !sessionToken) return;
    setLoadingMessages(true);
    setSelectedMessage(null);
    fetchShared("mail", { folderId: selectedFolderId, top: "25" })
      .then((data) => {
        const list = data.value || data.messages || [];
        setMessages(Array.isArray(list) ? list : []);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [authenticated, sessionToken, selectedFolderId, fetchShared]);

  if (!authenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a] p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
              <Lock className="h-6 w-6 text-primary" />
            </div>
            <CardTitle>{t("enterPassword")}</CardTitle>
            <CardDescription>{t("enterPasswordDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleUnlock()}
              placeholder={t("viewerPasswordPlaceholder")}
              autoFocus
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button onClick={handleUnlock} disabled={loading || !password} className="w-full">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
              {t("unlock")}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <FluentProvider theme={webLightTheme} style={{ height: "100vh" }}>
      <EmailLayout
        accountEmail={accountInfo?.email}
        sidebar={
          <Sidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
            accountEmail={accountInfo?.email || ""}
          />
        }
        messageList={
          <MessageList
            messages={messages}
            selectedMessageId={selectedMessage?.id || null}
            loading={loadingMessages}
            hasMore={false}
            onMessageSelect={setSelectedMessage}
            onSearch={() => {}}
            onLoadMore={() => {}}
          />
        }
        readingPane={
          <ReadingPane
            message={selectedMessage}
            attachments={[]}
            onDownloadAttachment={() => {}}
          />
        }
      />
    </FluentProvider>
  );
}
