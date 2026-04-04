"use client";

import { useState, useEffect, useMemo } from "react";
import { Avatar, Spinner } from "@fluentui/react-components";
import { People24Regular, Mail24Regular, Search20Regular } from "@fluentui/react-icons";
import type { Person } from "@/types/contacts";
import { t } from "@/i18n";

interface ContactsViewProps {
  accountId: string;
  onComposeToContact?: (email: string, name: string) => void;
}

export default function ContactsView({ accountId, onComposeToContact }: ContactsViewProps) {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/contacts/people?accountId=${accountId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setPeople(data.value || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return people;
    const lower = searchQuery.toLowerCase();
    return people.filter((p) => {
      const nameMatch = p.displayName?.toLowerCase().includes(lower);
      const emailMatch = p.scoredEmailAddresses?.some((e) => e.address.toLowerCase().includes(lower));
      const companyMatch = p.companyName?.toLowerCase().includes(lower);
      return nameMatch || emailMatch || companyMatch;
    });
  }, [people, searchQuery]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff" }}>
        <Spinner size="medium" label={t("contactsLoadingContacts")} />
      </div>
    );
  }

  return (
    <div style={{ height: "100%", background: "#ffffff", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px 12px",
        borderBottom: "1px solid #e0e0e0",
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
          <People24Regular style={{ color: "#0f6cbd", fontSize: 22 }} />
          <span style={{ fontSize: 18, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
            {t("contactsTitle")}
          </span>
        </div>

        {/* Search input */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: "#f5f5f5",
          borderRadius: 4,
          padding: "6px 12px",
          border: "1px solid #e0e0e0",
        }}>
          <Search20Regular style={{ color: "#616161", flexShrink: 0 }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("contactsSearchPlaceholder")}
            style={{
              border: "none",
              background: "transparent",
              outline: "none",
              fontSize: 14,
              color: "#242424",
              width: "100%",
              fontFamily: "'Segoe UI', sans-serif",
            }}
          />
        </div>
      </div>

      {/* Contact list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#616161", fontFamily: "'Segoe UI', sans-serif", fontSize: 14 }}>
            {t("contactsNoContacts")}
          </div>
        ) : (
          filtered.map((person) => {
            const primaryEmail = person.scoredEmailAddresses?.[0]?.address || "";
            return (
              <div
                key={person.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "10px 24px",
                  borderBottom: "1px solid #f0f0f0",
                  cursor: "default",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "#f5f5f5";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                <Avatar
                  name={person.displayName}
                  size={36}
                  color="colorful"
                />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#242424",
                    fontFamily: "'Segoe UI', sans-serif",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}>
                    {person.displayName}
                  </div>
                  {primaryEmail && (
                    <div style={{
                      fontSize: 12,
                      color: "#616161",
                      fontFamily: "'Segoe UI', sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {primaryEmail}
                    </div>
                  )}
                  {person.jobTitle && (
                    <div style={{
                      fontSize: 12,
                      color: "#a0a0a0",
                      fontFamily: "'Segoe UI', sans-serif",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {person.jobTitle}{person.companyName ? ` · ${person.companyName}` : ""}
                    </div>
                  )}
                </div>

                {primaryEmail && onComposeToContact && (
                  <button
                    onClick={() => onComposeToContact(primaryEmail, person.displayName)}
                    title={t("contactsComposeEmail")}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: 32,
                      height: 32,
                      borderRadius: 4,
                      border: "1px solid #e0e0e0",
                      background: "transparent",
                      cursor: "pointer",
                      color: "#0f6cbd",
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "#ebf3fc";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                    }}
                  >
                    <Mail24Regular style={{ fontSize: 16 }} />
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
