"use client";

import { Text } from "@fluentui/react-components";
import {
  Mail24Regular,
  Send24Regular,
  Drafts24Regular,
  Delete24Regular,
  Archive24Regular,
  Warning24Regular,
} from "@fluentui/react-icons";
import type { MailFolder } from "@/types/mail";
import { t } from "@/i18n";
import type { ReactElement } from "react";
import { useState } from "react";

const folderIcons: Record<string, ReactElement> = {
  inbox: <Mail24Regular />,
  sentitems: <Send24Regular />,
  drafts: <Drafts24Regular />,
  deleteditems: <Delete24Regular />,
  archive: <Archive24Regular />,
  junkemail: <Warning24Regular />,
};

const folderIconColors: Record<string, string> = {
  inbox: "#0f6cbd",
  sentitems: "#0f6cbd",
  drafts: "#0f6cbd",
  deleteditems: "#d13438",
  archive: "#0f6cbd",
  junkemail: "#eaa300",
};

const folderTranslationKeys: Record<string, string> = {
  inbox: "inbox",
  sentitems: "sentItems",
  drafts: "drafts",
  deleteditems: "deletedItems",
  archive: "archive",
  junkemail: "junkEmail",
};

interface SidebarProps {
  folders: MailFolder[];
  selectedFolderId: string | null;
  onFolderSelect: (folderId: string) => void;
  accountEmail: string;
}

export default function Sidebar({
  folders,
  selectedFolderId,
  onFolderSelect,
  accountEmail,
}: SidebarProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const getFolderKey = (displayName: string) =>
    displayName.toLowerCase().replace(/\s/g, "");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #e0e0e0" }}>
        <Text weight="semibold" size={300} block style={{ color: "#242424" }}>
          {accountEmail}
        </Text>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "4px 0" }}>
        {folders.map((folder) => {
          const key = getFolderKey(folder.displayName);
          const icon = folderIcons[key] || <Mail24Regular />;
          const iconColor = folderIconColors[key] || "#0f6cbd";
          const translationKey = folderTranslationKeys[key];
          const label = translationKey
            ? t(translationKey as Parameters<typeof t>[0])
            : folder.displayName;
          const isSelected = selectedFolderId === folder.id;
          const isHovered = hoveredId === folder.id;

          return (
            <div
              key={folder.id}
              onClick={() => onFolderSelect(folder.id)}
              onMouseEnter={() => setHoveredId(folder.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "6px 12px",
                cursor: "pointer",
                backgroundColor: isSelected
                  ? "#e0e0e0"
                  : isHovered
                    ? "#ebebeb"
                    : "transparent",
                borderRadius: 4,
                margin: "1px 4px",
              }}
            >
              <span style={{ color: iconColor, display: "flex", alignItems: "center", fontSize: 18 }}>
                {icon}
              </span>
              <Text
                size={300}
                weight={isSelected ? "semibold" : "regular"}
                style={{
                  flex: 1,
                  color: "#242424",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {label}
              </Text>
              {folder.unreadItemCount > 0 && (
                <span
                  style={{
                    backgroundColor: "#0f6cbd",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 600,
                    borderRadius: 10,
                    padding: "1px 7px",
                    minWidth: 18,
                    textAlign: "center",
                    lineHeight: "18px",
                  }}
                >
                  {folder.unreadItemCount}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
