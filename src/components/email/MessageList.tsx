"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import {
  Avatar,
  Text,
  Checkbox,
  Spinner,
} from "@fluentui/react-components";
import { Attach24Regular } from "@fluentui/react-icons";
import type { EmailMessage } from "@/types/mail";
import { t } from "@/i18n";

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return date.toLocaleDateString("en", { weekday: "short" });
  return date.toLocaleDateString("en", { month: "short", day: "numeric" });
}

interface MessageListProps {
  messages: EmailMessage[];
  selectedMessageId: string | null;
  loading: boolean;
  hasMore: boolean;
  onMessageSelect: (message: EmailMessage) => void;
  onSearch: (query: string) => void;
  onLoadMore: () => void;
}

export default function MessageList({
  messages,
  selectedMessageId,
  loading,
  hasMore,
  onMessageSelect,
  onSearch,
  onLoadMore,
}: MessageListProps) {
  const [searchValue, setSearchValue] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Infinite scroll — auto-load when sentinel is visible
  useEffect(() => {
    if (!hasMore || loading) return;
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          onLoadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loading, onLoadMore]);

  const handleSearch = useCallback(
    (value: string) => {
      setSearchValue(value);
      if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = setTimeout(() => {
        onSearch(value);
      }, 300);
    },
    [onSearch]
  );

  const toggleSelect = (id: string, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "4px 12px 8px",
        borderBottom: "1px solid #f0f0f0",
      }}>
        <Text size={400} weight="semibold" style={{ color: "#242424" }}>
          {t("inbox")}
        </Text>
      </div>

      <div style={{ flex: 1, overflow: "auto" }}>
        {loading && messages.length === 0 ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 40 }}>
            <Spinner size="medium" label={t("loading")} />
          </div>
        ) : messages.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center" }}>
            <Text style={{ color: "#616161" }}>{t("noMessages")}</Text>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelected = selectedMessageId === msg.id;
            const isHovered = hoveredId === msg.id;
            const senderName =
              msg.from?.emailAddress?.name || msg.from?.emailAddress?.address || "";

            return (
              <div
                key={msg.id}
                onClick={() => onMessageSelect(msg)}
                onMouseEnter={() => setHoveredId(msg.id)}
                onMouseLeave={() => setHoveredId(null)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "10px 12px",
                  cursor: "pointer",
                  backgroundColor: isSelected
                    ? "#ebf3fc"
                    : isHovered
                      ? "#f5f5f5"
                      : "#ffffff",
                  borderBottom: "1px solid #f0f0f0",
                  borderLeft: isSelected ? "2px solid #0f6cbd" : "2px solid transparent",
                }}
              >
                <div style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: 4,
                  paddingTop: 2,
                }}>
                  <div style={{
                    opacity: isHovered || selectedIds.has(msg.id) ? 1 : 0,
                    width: 18,
                    height: 18,
                  }}>
                    <Checkbox
                      checked={selectedIds.has(msg.id)}
                      onChange={(_, data) => toggleSelect(msg.id, data.checked === true)}
                      onClick={(e) => e.stopPropagation()}
                      style={{ margin: 0, padding: 0 }}
                    />
                  </div>
                </div>

                <div
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    backgroundColor: !msg.isRead
                      ? "#0f6cbd"
                      : "transparent",
                    marginTop: 14,
                    flexShrink: 0,
                  }}
                />

                <Avatar name={senderName} size={32} color="colorful" style={{ flexShrink: 0, marginTop: 2 }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Text
                      weight={!msg.isRead ? "bold" : "regular"}
                      size={300}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#242424",
                      }}
                    >
                      {senderName}
                    </Text>
                    <Text size={200} style={{ flexShrink: 0, marginLeft: 8, color: "#616161" }}>
                      {formatRelativeTime(msg.receivedDateTime)}
                    </Text>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                    <Text
                      weight={!msg.isRead ? "semibold" : "regular"}
                      size={200}
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        color: "#242424",
                      }}
                    >
                      {msg.subject || "(no subject)"}
                    </Text>
                    {msg.hasAttachments && (
                      <Attach24Regular style={{ flexShrink: 0, fontSize: 14, color: "#616161" }} />
                    )}
                  </div>

                  <Text
                    size={200}
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      display: "block",
                      color: "#707070",
                    }}
                  >
                    {msg.bodyPreview}
                  </Text>
                </div>
              </div>
            );
          })
        )}

        {/* Infinite scroll sentinel */}
        {hasMore && (
          <div ref={sentinelRef} style={{ height: 1 }} />
        )}

        {loading && messages.length > 0 && (
          <div style={{ padding: 12, textAlign: "center" }}>
            <Spinner size="tiny" />
          </div>
        )}
      </div>
    </div>
  );
}
