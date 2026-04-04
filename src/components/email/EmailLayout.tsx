"use client";

import { useRef, type ReactNode } from "react";
import {
  Mail24Filled,
  Calendar24Regular,
  People24Regular,
  Settings24Regular,
  Search20Regular,
} from "@fluentui/react-icons";
import { t } from "@/i18n";

interface EmailLayoutProps {
  toolbar: ReactNode;
  sidebar: ReactNode;
  messageList: ReactNode;
  readingPane: ReactNode;
  accountEmail?: string;
  onSearch: (query: string) => void;
  activeView: "mail" | "calendar" | "contacts" | "settings";
  onViewChange: (view: "mail" | "calendar" | "contacts" | "settings") => void;
  calendarView?: ReactNode;
  contactsView?: ReactNode;
  settingsView?: ReactNode;
}

export default function EmailLayout({
  toolbar,
  sidebar,
  messageList,
  readingPane,
  accountEmail,
  onSearch,
  activeView,
  onViewChange,
  calendarView,
  contactsView,
  settingsView,
}: EmailLayoutProps) {
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#f5f5f5" }}>
      {/* Top header — Outlook blue bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        height: 48,
        background: "#0f6cbd",
        padding: "0 16px",
        flexShrink: 0,
        gap: 16,
      }}>
        {/* Outlook logo */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Mail24Filled style={{ color: "#ffffff" }} />
          <span style={{ color: "#ffffff", fontSize: 16, fontWeight: 600, fontFamily: "'Segoe UI', sans-serif" }}>
            Outlook
          </span>
        </div>

        {/* Search bar */}
        <div style={{
          flex: 1,
          maxWidth: 500,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "rgba(255,255,255,0.7)",
          borderRadius: 4,
          padding: "4px 12px",
          height: 32,
        }}>
          <Search20Regular style={{ color: "#0c3b5e", flexShrink: 0 }} />
          <input
            type="text"
            placeholder={t("searchMailPeoplFiles")}
            onChange={handleSearchChange}
            onFocus={() => { if (activeView !== "mail") onViewChange("mail"); }}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              color: "#0c3b5e",
              fontSize: 14,
              fontFamily: "'Segoe UI', sans-serif",
              width: "100%",
            }}
          />
        </div>

        <div style={{ flex: 1 }} />

        {/* User avatar */}
        <div style={{
          width: 32,
          height: 32,
          borderRadius: "50%",
          background: "#0c3b5e",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: 14,
          fontWeight: 600,
        }}>
          {(accountEmail || "U").charAt(0).toUpperCase()}
        </div>
      </div>

      {/* Toolbar row — only visible for mail view */}
      {activeView === "mail" && (
        <div style={{
          flexShrink: 0,
          borderBottom: "1px solid #e0e0e0",
          background: "#ffffff",
        }}>
          {toolbar}
        </div>
      )}

      {/* Main content area */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Far-left icon strip */}
        <div style={{
          width: 48,
          flexShrink: 0,
          background: "#fafafa",
          borderRight: "1px solid #e0e0e0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          paddingTop: 8,
          gap: 4,
        }}>
          <IconButton
            icon={<Mail24Filled />}
            active={activeView === "mail"}
            onClick={() => onViewChange("mail")}
          />
          <IconButton
            icon={<Calendar24Regular />}
            active={activeView === "calendar"}
            onClick={() => onViewChange("calendar")}
          />
          <IconButton
            icon={<People24Regular />}
            active={activeView === "contacts"}
            onClick={() => onViewChange("contacts")}
          />
          <div style={{ flex: 1 }} />
          <IconButton
            icon={<Settings24Regular />}
            active={activeView === "settings"}
            onClick={() => onViewChange("settings")}
          />
          <div style={{ height: 8 }} />
        </div>

        {/* Content based on active view */}
        {activeView === "mail" && (
          <>
            {/* Folder sidebar */}
            <div style={{
              width: 200,
              flexShrink: 0,
              borderRight: "1px solid #e0e0e0",
              background: "#fafafa",
              overflow: "auto",
            }}>
              {sidebar}
            </div>

            {/* Message list */}
            <div style={{
              width: 360,
              flexShrink: 0,
              borderRight: "1px solid #e0e0e0",
              background: "#ffffff",
              overflow: "auto",
            }}>
              {messageList}
            </div>

            {/* Reading pane */}
            <div style={{
              flex: 1,
              overflow: "auto",
              background: "#f5f5f5",
            }}>
              {readingPane}
            </div>
          </>
        )}

        {activeView === "calendar" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {calendarView}
          </div>
        )}

        {activeView === "contacts" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {contactsView}
          </div>
        )}

        {activeView === "settings" && (
          <div style={{ flex: 1, overflow: "hidden" }}>
            {settingsView}
          </div>
        )}
      </div>
    </div>
  );
}

function IconButton({
  icon,
  active,
  onClick,
}: {
  icon: ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 40,
        height: 40,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 6,
        cursor: "pointer",
        color: active ? "#0f6cbd" : "#616161",
        background: active ? "#ebf3fc" : "transparent",
      }}
    >
      {icon}
    </div>
  );
}
