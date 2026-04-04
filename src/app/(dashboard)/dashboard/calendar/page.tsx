"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { CalendarDays, Mail } from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface CalendarEvent {
  subject: string;
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  location?: { displayName: string };
  isAllDay: boolean;
  organizer?: { emailAddress: { name: string; address: string } };
}

interface EventRow {
  dateKey: string;
  dateLabel: string;
  time: string;
  subject: string;
  location: string;
  organizer: string;
}

function toLocalDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function toLocalTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function toDateInputValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function CalendarPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const today = new Date();
  const defaultTo = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [fromDate, setFromDate] = useState(toDateInputValue(today));
  const [toDate, setToDate] = useState(toDateInputValue(defaultTo));
  const [loading, setLoading] = useState(false);
  const [events, setEvents] = useState<EventRow[]>([]);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccounts((data.accounts || []).filter((a: Account) => a.status === "ACTIVE"));
      })
      .catch(() => {});
  }, [status]);

  const loadEvents = async () => {
    if (!selectedAccountId) return;
    setLoading(true);
    setEvents([]);
    setHasLoaded(false);

    try {
      const startDateTime = new Date(fromDate).toISOString();
      const endDateTime = new Date(toDate + "T23:59:59").toISOString();

      const res = await fetch(
        `/api/calendar?accountId=${selectedAccountId}&startDateTime=${encodeURIComponent(startDateTime)}&endDateTime=${encodeURIComponent(endDateTime)}`
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        setLoading(false);
        setHasLoaded(true);
        return;
      }

      const rows: EventRow[] = (data.value || []).map((ev: CalendarEvent) => {
        const dateKey = new Date(ev.start.dateTime).toISOString().slice(0, 10);
        return {
          dateKey,
          dateLabel: ev.isAllDay ? toLocalDate(ev.start.dateTime) : toLocalDate(ev.start.dateTime),
          time: ev.isAllDay
            ? t("calendarAllDay")
            : `${toLocalTime(ev.start.dateTime)} – ${toLocalTime(ev.end.dateTime)}`,
          subject: ev.subject || "—",
          location: ev.location?.displayName || "—",
          organizer: ev.organizer?.emailAddress?.name || ev.organizer?.emailAddress?.address || "—",
        };
      });

      setEvents(rows);
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  // Group events by dateKey
  const groupedDates = Array.from(new Set(events.map((e) => e.dateKey))).sort();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <CalendarDays className="h-7 w-7" />
        {t("calendar")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("calendar")}</CardTitle>
          <CardDescription>{t("calendarDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t("accounts")}
              </label>
              <Select
                value={selectedAccountId}
                onValueChange={(v) => {
                  if (!v) return;
                  setSelectedAccountId(v);
                  setEvents([]);
                  setHasLoaded(false);
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("selectAccount")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="" disabled>
                    {t("selectAccount")}
                  </SelectItem>
                  {accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      <div className="flex items-center gap-2">
                        <Mail className="h-3 w-3" />
                        {a.email}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t("calendarFrom")}
              </label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t("calendarTo")}
              </label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>

            <Button onClick={loadEvents} disabled={!selectedAccountId || loading}>
              <CalendarDays className="mr-1 h-4 w-4" />
              {loading ? t("loading") : t("calendarLoad")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingText className="text-muted-foreground" />
        </div>
      )}

      {!loading && hasLoaded && events.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle>{t("calendar")}</CardTitle>
              <Badge variant="secondary">
                {t("calendarTotal", { count: String(events.length) })}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("calendarTime")}</TableHead>
                    <TableHead>{t("subject")}</TableHead>
                    <TableHead>{t("calendarLocation")}</TableHead>
                    <TableHead>{t("calendarOrganizer")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {groupedDates.map((dateKey) => {
                    const dayEvents = events.filter((e) => e.dateKey === dateKey);
                    return (
                      <React.Fragment key={dateKey}>
                        <TableRow className="bg-muted/30">
                          <TableCell colSpan={5} className="py-1.5 text-xs font-semibold text-muted-foreground">
                            {dayEvents[0].dateLabel}
                          </TableCell>
                        </TableRow>
                        {dayEvents.map((ev, idx) => (
                          <TableRow key={`${dateKey}-${idx}`}>
                            <TableCell className="text-xs text-muted-foreground w-4"></TableCell>
                            <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{ev.time}</TableCell>
                            <TableCell className="text-sm font-medium">{ev.subject}</TableCell>
                            <TableCell className="text-sm">{ev.location}</TableCell>
                            <TableCell className="text-sm">{ev.organizer}</TableCell>
                          </TableRow>
                        ))}
                      </React.Fragment>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {!loading && hasLoaded && events.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("noResults")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
