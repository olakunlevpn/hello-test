"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@fluentui/react-components";
import { Calendar24Regular, Location24Regular } from "@fluentui/react-icons";
import type { CalendarEvent } from "@/types/contacts";
import { t } from "@/i18n";

interface CalendarViewProps {
  accountId: string;
}

export default function CalendarView({ accountId }: CalendarViewProps) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accountId) return;
    setLoading(true);
    fetch(`/api/calendar?accountId=${accountId}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setEvents(data.value || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [accountId]);

  const groupEventsByDate = (eventList: CalendarEvent[]) => {
    const groups: Record<string, CalendarEvent[]> = {};
    for (const ev of eventList) {
      const dateKey = new Date(ev.start.dateTime).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(ev);
    }
    return groups;
  };

  const formatTime = (dateTimeStr: string) => {
    return new Date(dateTimeStr).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", background: "#ffffff" }}>
        <Spinner size="medium" label={t("calendarLoadingEvents")} />
      </div>
    );
  }

  const grouped = groupEventsByDate(events);
  const dateKeys = Object.keys(grouped);

  return (
    <div style={{ height: "100%", background: "#ffffff", overflow: "auto" }}>
      {/* Header */}
      <div style={{
        padding: "16px 24px",
        borderBottom: "1px solid #e0e0e0",
        display: "flex",
        alignItems: "center",
        gap: 10,
        background: "#ffffff",
        position: "sticky",
        top: 0,
        zIndex: 1,
      }}>
        <Calendar24Regular style={{ color: "#0f6cbd", fontSize: 22 }} />
        <span style={{ fontSize: 18, fontWeight: 600, color: "#242424", fontFamily: "'Segoe UI', sans-serif" }}>
          {t("calendarUpcomingEvents")}
        </span>
      </div>

      {/* Events */}
      <div style={{ padding: "16px 24px" }}>
        {dateKeys.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#616161", fontFamily: "'Segoe UI', sans-serif", fontSize: 14 }}>
            {t("calendarNoEvents")}
          </div>
        ) : (
          dateKeys.map((dateKey) => (
            <div key={dateKey} style={{ marginBottom: 24 }}>
              {/* Date header */}
              <div style={{
                fontSize: 13,
                fontWeight: 600,
                color: "#0f6cbd",
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                marginBottom: 8,
                fontFamily: "'Segoe UI', sans-serif",
                paddingBottom: 6,
                borderBottom: "2px solid #ebf3fc",
              }}>
                {dateKey}
              </div>

              {/* Events for this date */}
              {grouped[dateKey].map((ev, idx) => (
                <div key={idx} style={{
                  display: "flex",
                  gap: 12,
                  padding: "10px 12px",
                  borderRadius: 6,
                  marginBottom: 6,
                  border: "1px solid #e0e0e0",
                  background: "#fafafa",
                  cursor: "default",
                }}>
                  {/* Time column */}
                  <div style={{
                    minWidth: 80,
                    fontSize: 12,
                    color: "#616161",
                    fontFamily: "'Segoe UI', sans-serif",
                    paddingTop: 2,
                    flexShrink: 0,
                  }}>
                    {ev.isAllDay ? (
                      <span>{t("calendarAllDay")}</span>
                    ) : (
                      <>
                        <div>{formatTime(ev.start.dateTime)}</div>
                        <div style={{ color: "#a0a0a0" }}>{formatTime(ev.end.dateTime)}</div>
                      </>
                    )}
                  </div>

                  {/* Color indicator */}
                  <div style={{ width: 3, borderRadius: 2, background: "#0f6cbd", flexShrink: 0 }} />

                  {/* Event details */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14,
                      fontWeight: 600,
                      color: "#242424",
                      fontFamily: "'Segoe UI', sans-serif",
                      marginBottom: ev.location?.displayName ? 4 : 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}>
                      {ev.subject || "(No title)"}
                    </div>
                    {ev.location?.displayName && (
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Location24Regular style={{ color: "#616161", fontSize: 12 }} />
                        <span style={{
                          fontSize: 12,
                          color: "#616161",
                          fontFamily: "'Segoe UI', sans-serif",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}>
                          {ev.location.displayName}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
