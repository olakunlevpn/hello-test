"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, Loader2, Mail, Inbox, RefreshCw } from "lucide-react";
import { t } from "@/i18n";
import DOMPurify from "dompurify";

interface MailFolder {
  id: string;
  displayName: string;
  totalItemCount: number;
  unreadItemCount: number;
}

interface EmailMessage {
  id: string;
  subject: string;
  from: { emailAddress: { name: string; address: string } };
  receivedDateTime: string;
  isRead: boolean;
  bodyPreview: string;
  body?: { content: string; contentType: string };
}

export default function SharedLinkPage() {
  const { code } = useParams<{ code: string }>();
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [sessionToken, setSessionToken] = useState("");
  const [accountInfo, setAccountInfo] = useState<{ email: string; displayName: string } | null>(null);

  // Email state
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

  // Load folders after auth
  useEffect(() => {
    if (!authenticated || !sessionToken) return;
    fetchShared("folders")
      .then((data) => setFolders(data.folders || []))
      .catch(() => {});
  }, [authenticated, sessionToken, fetchShared]);

  // Load messages when folder changes
  useEffect(() => {
    if (!authenticated || !sessionToken) return;
    setLoadingMessages(true);
    setSelectedMessage(null);
    fetchShared("mail", { folderId: selectedFolderId, top: "25" })
      .then((data) => setMessages(data.value || []))
      .catch(() => setMessages([]))
      .finally(() => setLoadingMessages(false));
  }, [authenticated, sessionToken, selectedFolderId, fetchShared]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleString("en-US", { dateStyle: "short", timeStyle: "short" });

  // ─── Password Gate ───
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

  // ─── Email Viewer ───
  return (
    <div className="h-screen flex flex-col bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-border px-4 py-2 bg-card shrink-0">
        <Mail className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium">{accountInfo?.displayName}</span>
        <span className="text-xs text-muted-foreground">({accountInfo?.email})</span>
        <span className="ml-auto text-xs text-muted-foreground">{t("sharedEmailView")}</span>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Folder Sidebar */}
        <div className="w-48 border-r border-border overflow-y-auto shrink-0 bg-card">
          <div className="p-2 space-y-0.5">
            {folders.map((folder) => (
              <button
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                className={`w-full text-left px-3 py-1.5 rounded text-sm flex justify-between items-center ${
                  selectedFolderId === folder.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="truncate">{folder.displayName}</span>
                {folder.unreadItemCount > 0 && (
                  <Badge variant="secondary" className="text-xs ml-1">{folder.unreadItemCount}</Badge>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Message List */}
        <div className="w-80 border-r border-border overflow-y-auto shrink-0">
          <div className="flex items-center justify-between p-2 border-b border-border">
            <span className="text-xs text-muted-foreground">{messages.length} {t("emails")}</span>
            <Button variant="ghost" size="sm" onClick={() => setSelectedFolderId(selectedFolderId)}>
              <RefreshCw className="h-3 w-3" />
            </Button>
          </div>
          {loadingMessages ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Inbox className="h-8 w-8 mb-2" />
              <span className="text-sm">{t("noResults")}</span>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {messages.map((msg) => (
                <button
                  key={msg.id}
                  onClick={() => setSelectedMessage(msg)}
                  className={`w-full text-left p-3 hover:bg-muted ${
                    selectedMessage?.id === msg.id ? "bg-primary/5" : ""
                  } ${!msg.isRead ? "border-l-2 border-l-primary" : ""}`}
                >
                  <p className="text-sm font-medium truncate">{msg.from?.emailAddress?.name || msg.from?.emailAddress?.address}</p>
                  <p className="text-sm truncate">{msg.subject || "(no subject)"}</p>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{msg.bodyPreview}</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatDate(msg.receivedDateTime)}</p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reading Pane */}
        <div className="flex-1 overflow-y-auto">
          {selectedMessage ? (
            <div className="p-6">
              <h2 className="text-lg font-semibold mb-1">{selectedMessage.subject || "(no subject)"}</h2>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                <span>{selectedMessage.from?.emailAddress?.name}</span>
                <span>&lt;{selectedMessage.from?.emailAddress?.address}&gt;</span>
                <span className="ml-auto">{formatDate(selectedMessage.receivedDateTime)}</span>
              </div>
              <div
                className="prose prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{
                  __html: DOMPurify.sanitize(
                    selectedMessage.body?.content || selectedMessage.bodyPreview || ""
                  ),
                }}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-muted-foreground">
              <div className="text-center">
                <Mail className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("selectAnEmail")}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
