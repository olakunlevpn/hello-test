"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useParams } from "next/navigation";
import { Spinner } from "@fluentui/react-components";
import EmailLayout from "@/components/email/EmailLayout";
import Toolbar from "@/components/email/Toolbar";
import Sidebar from "@/components/email/Sidebar";
import MessageList from "@/components/email/MessageList";
import ReadingPane from "@/components/email/ReadingPane";
import ComposeModal from "@/components/email/ComposeModal";
import FolderPickerDialog from "@/components/email/FolderPickerDialog";
import CalendarView from "@/components/email/CalendarView";
import ContactsView from "@/components/email/ContactsView";
import SettingsView from "@/components/email/SettingsView";
import type { EmailMessage, MailFolder, EmailAttachment } from "@/types/mail";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

export default function EmailClientPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const { status } = useSession();

  const [accountEmail, setAccountEmail] = useState("");
  const [folders, setFolders] = useState<MailFolder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [archiveFolderId, setArchiveFolderId] = useState<string | null>(null);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
  const [loading, setLoading] = useState(false);
  const [nextLink, setNextLink] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeMode, setComposeMode] = useState<"compose" | "reply" | "replyAll" | "forward">("compose");
  const [folderPickerOpen, setFolderPickerOpen] = useState(false);
  const [activeView, setActiveView] = useState<"mail" | "calendar" | "contacts" | "settings">("mail");
  const [composeContactTo, setComposeContactTo] = useState<{ email: string; name: string } | null>(null);
  const [ghostModeActive, setGhostModeActive] = useState(false);

  // Load account info
  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const account = (data.accounts || []).find(
          (a: { id: string }) => a.id === accountId
        );
        if (account) {
          setAccountEmail(account.email);
          document.title = `${account.email} — ${t("appName")}`;
        }
      })
      .catch(() => {
        // silently handle
      });
  }, [status, accountId]);

  // Load folders
  const loadFolders = useCallback(() => {
    if (!accountId) return;
    fetch(`/api/folders?accountId=${accountId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        const folderList = data.value || [];
        setFolders(folderList);
        const inbox = folderList.find(
          (f: MailFolder) => f.displayName.toLowerCase() === "inbox"
        );
        if (inbox && !selectedFolderId) setSelectedFolderId(inbox.id);
        const archive = folderList.find(
          (f: MailFolder) => f.displayName.toLowerCase() === "archive"
        );
        if (archive) setArchiveFolderId(archive.id);
      })
      .catch(() => {});
  }, [accountId, selectedFolderId]);

  useEffect(() => {
    if (status !== "authenticated") return;
    loadFolders();
  }, [status, loadFolders]);

  // Load messages
  const loadMessages = useCallback(
    async (search?: string) => {
      if (!accountId) return;
      setLoading(true);
      const params = new URLSearchParams({
        accountId,
        top: "25",
        orderby: "receivedDateTime desc",
      });
      if (selectedFolderId) params.set("folderId", selectedFolderId);
      if (search) params.set("search", search);

      try {
        const res = await fetch(`/api/mail?${params}`);
        if (!res.ok) { setMessages([]); return; }
        const data = await res.json();
        setMessages(data.value || []);
        setNextLink(data["@odata.nextLink"] || null);
      } catch {
        setMessages([]);
      } finally {
        setLoading(false);
      }
    },
    [accountId, selectedFolderId]
  );

  useEffect(() => {
    if (selectedFolderId) loadMessages();
  }, [loadMessages, selectedFolderId]);

  const handleMessageSelect = async (msg: EmailMessage) => {
    setSelectedMessage(msg);
    setAttachments([]);

    if (!msg.isRead && !ghostModeActive) {
      try {
        const markRes = await fetch(`/api/mail/${msg.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accountId, isRead: true }),
        });
        if (markRes.ok) {
          setMessages((prev) =>
            prev.map((m) => (m.id === msg.id ? { ...m, isRead: true } : m))
          );
        }
      } catch {
        // silently handle
      }
    }

    try {
      const fullRes = await fetch(`/api/mail/${msg.id}?accountId=${accountId}`);
      if (!fullRes.ok) return;
      const fullMsg = await fullRes.json();
      setSelectedMessage(fullMsg);

      // Load attachments if message has them
      if (fullMsg.hasAttachments) {
        try {
          const attRes = await fetch(`/api/mail/${msg.id}/attachments?accountId=${accountId}`);
          if (attRes.ok) {
            const attData = await attRes.json();
            setAttachments(attData.value || []);
          }
        } catch {
          // silently handle
        }
      }
    } catch {
      // silently handle
    }
  };

  const handleDownloadAttachment = async (attachmentId: string) => {
    if (!selectedMessage) return;
    try {
      const res = await fetch(
        `/api/mail/${selectedMessage.id}/attachments/${attachmentId}?accountId=${accountId}`
      );
      if (!res.ok) return;
      const att = await res.json();
      if (att.contentBytes) {
        // Convert base64 to blob and trigger download
        const byteCharacters = atob(att.contentBytes);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: att.contentType || "application/octet-stream" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = att.name || "attachment";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    } catch {
      // silently handle
    }
  };

  const handleLoadMore = async () => {
    if (!nextLink) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/mail?accountId=${accountId}&nextLink=${encodeURIComponent(nextLink)}`
      );
      if (!res.ok) return;
      const data = await res.json();
      setMessages((prev) => [...prev, ...(data.value || [])]);
      setNextLink(data["@odata.nextLink"] || null);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedMessage) return;
    try {
      const res = await fetch(`/api/mail/${selectedMessage.id}?accountId=${accountId}`, { method: "DELETE" });
      if (!res.ok) return;
      setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
      setSelectedMessage(null);
      setAttachments([]);
      // Refresh folder counts (deleted items count updates)
      loadFolders();
    } catch {
      // silently handle
    }
  };

  const handleMarkUnread = async () => {
    if (!selectedMessage) return;
    try {
      const res = await fetch(`/api/mail/${selectedMessage.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, isRead: false }),
      });
      if (!res.ok) return;
      setMessages((prev) =>
        prev.map((m) => (m.id === selectedMessage.id ? { ...m, isRead: false } : m))
      );
    } catch {
      // silently handle
    }
  };

  const handleArchive = async () => {
    if (!selectedMessage || !archiveFolderId) return;
    try {
      const res = await fetch(`/api/mail/${selectedMessage.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, destinationId: archiveFolderId }),
      });
      if (!res.ok) return;
      setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
      setSelectedMessage(null);
      setAttachments([]);
      loadFolders();
    } catch {
      // silently handle
    }
  };

  const handleMoveToFolder = async (folderId: string) => {
    if (!selectedMessage) return;
    try {
      const res = await fetch(`/api/mail/${selectedMessage.id}/move`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, destinationId: folderId }),
      });
      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== selectedMessage.id));
        setSelectedMessage(null);
        setAttachments([]);
        loadFolders();
      }
    } catch {
      // silently handle
    }
  };

  const openCompose = (mode: "compose" | "reply" | "replyAll" | "forward") => {
    setComposeContactTo(null);
    setComposeMode(mode);
    setComposeOpen(true);
  };

  // Load ghost mode state from account settings
  useEffect(() => {
    if (!accountId) return;
    fetch(`/api/account-settings?accountId=${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.settings) {
          setGhostModeActive(data.settings.fullSilentMode);
        }
      })
      .catch(() => {});
  }, [accountId]);

  const handleGhostModeToggle = async () => {
    const newValue = !ghostModeActive;
    setGhostModeActive(newValue);
    try {
      await fetch("/api/account-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId, fullSilentMode: newValue }),
      });
    } catch {
      setGhostModeActive(!newValue);
    }
  };

  const handleComposeToContact = (email: string, name: string) => {
    setComposeContactTo({ email, name });
    setComposeMode("compose");
    setComposeOpen(true);
    setActiveView("mail");
  };

  if (status === "loading") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh" }}>
        <Spinner size="large" label={<LoadingText />} />
      </div>
    );
  }

  return (
    <>
      <EmailLayout
        accountEmail={accountEmail}
        onSearch={(q) => loadMessages(q)}
        activeView={activeView}
        onViewChange={setActiveView}
        toolbar={
          <Toolbar
            onCompose={() => openCompose("compose")}
            onReply={() => openCompose("reply")}
            onReplyAll={() => openCompose("replyAll")}
            onForward={() => openCompose("forward")}
            onDelete={handleDelete}
            onArchive={handleArchive}
            onMoveToFolder={() => setFolderPickerOpen(true)}
            onMarkUnread={handleMarkUnread}
            hasSelectedMessage={!!selectedMessage}
            ghostModeActive={ghostModeActive}
            onGhostModeToggle={handleGhostModeToggle}
          />
        }
        sidebar={
          <Sidebar
            folders={folders}
            selectedFolderId={selectedFolderId}
            onFolderSelect={setSelectedFolderId}
            accountEmail={accountEmail}
          />
        }
        messageList={
          <MessageList
            messages={messages}
            selectedMessageId={selectedMessage?.id || null}
            loading={loading}
            hasMore={!!nextLink}
            onMessageSelect={handleMessageSelect}
            onSearch={(q) => loadMessages(q)}
            onLoadMore={handleLoadMore}
          />
        }
        readingPane={
          <ReadingPane
            message={selectedMessage}
            attachments={attachments}
            onDownloadAttachment={handleDownloadAttachment}
          />
        }
        calendarView={<CalendarView accountId={accountId} />}
        contactsView={
          <ContactsView
            accountId={accountId}
            onComposeToContact={handleComposeToContact}
          />
        }
        settingsView={
          <SettingsView
            accountId={accountId}
            folders={folders}
            onFoldersChange={loadFolders}
          />
        }
      />

      {composeOpen && (
        <ComposeModal
          open={composeOpen}
          onClose={() => { setComposeOpen(false); setComposeContactTo(null); loadMessages(); }}
          accountId={accountId}
          fromEmail={accountEmail}
          mode={composeMode}
          replyMessageId={selectedMessage?.id}
          initialSubject={
            composeMode === "reply" || composeMode === "replyAll"
              ? `Re: ${selectedMessage?.subject || ""}`
              : composeMode === "forward"
                ? `Fwd: ${selectedMessage?.subject || ""}`
                : ""
          }
          initialTo={
            composeContactTo
              ? [{ emailAddress: { name: composeContactTo.name, address: composeContactTo.email } }]
              : composeMode === "reply" && selectedMessage?.from
                ? [selectedMessage.from]
                : composeMode === "replyAll"
                  ? [
                      ...(selectedMessage?.from ? [selectedMessage.from] : []),
                      ...(selectedMessage?.toRecipients || []),
                    ]
                  : []
          }
          initialCc={composeMode === "replyAll" ? selectedMessage?.ccRecipients || [] : []}
        />
      )}

      <FolderPickerDialog
        open={folderPickerOpen}
        onClose={() => setFolderPickerOpen(false)}
        folders={folders}
        currentFolderId={selectedFolderId}
        onMove={handleMoveToFolder}
      />
    </>
  );
}
