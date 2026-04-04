"use client";

import { useEffect, useState } from "react";
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
import { Mail, Copy, Download, Users } from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface ContactRow {
  id: string;
  displayName: string;
  email: string;
  companyName: string;
  jobTitle: string;
}

export default function ContactsPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccounts((data.accounts || []).filter((a: Account) => a.status === "ACTIVE"));
      })
      .catch(() => {});
  }, [status]);

  const loadContacts = async (accountId: string) => {
    setLoading(true);
    setContacts([]);

    const contactMap = new Map<string, ContactRow>();

    const addContact = (
      id: string,
      displayName: string,
      email: string,
      companyName: string,
      jobTitle: string
    ) => {
      const key = email.toLowerCase();
      if (!key || !key.includes("@")) return;
      if (!contactMap.has(key)) {
        contactMap.set(key, { id, displayName, email: key, companyName, jobTitle });
      } else {
        const existing = contactMap.get(key)!;
        contactMap.set(key, {
          id: existing.id,
          displayName: displayName || existing.displayName,
          email: key,
          companyName: companyName || existing.companyName,
          jobTitle: jobTitle || existing.jobTitle,
        });
      }
    };

    try {
      const [contactsRes, peopleRes] = await Promise.allSettled([
        fetch(`/api/contacts?accountId=${accountId}`),
        fetch(`/api/contacts/people?accountId=${accountId}`),
      ]);

      if (contactsRes.status === "fulfilled" && contactsRes.value.ok) {
        const data = await contactsRes.value.json();
        if (data.error) {
          toast.error(translateError(data.error));
        } else {
          for (const c of data.value || []) {
            const name =
              c.displayName ||
              [c.givenName, c.surname].filter(Boolean).join(" ") ||
              "";
            for (const ea of c.emailAddresses || []) {
              if (ea.address) {
                addContact(c.id || ea.address, name, ea.address, c.companyName || "", c.jobTitle || "");
              }
            }
          }
        }
      } else if (contactsRes.status === "fulfilled" && !contactsRes.value.ok) {
        const data = await contactsRes.value.json().catch(() => ({}));
        toast.error(translateError(data.error));
      }

      if (peopleRes.status === "fulfilled" && peopleRes.value.ok) {
        const data = await peopleRes.value.json();
        if (!data.error) {
          for (const p of data.value || []) {
            for (const ea of p.scoredEmailAddresses || []) {
              if (ea.address) {
                addContact(p.id || ea.address, p.displayName || "", ea.address, p.companyName || "", p.jobTitle || "");
              }
            }
          }
        }
      }

      const sorted = Array.from(contactMap.values()).sort((a, b) =>
        a.displayName.localeCompare(b.displayName)
      );
      setContacts(sorted);
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSearch("");
    if (accountId) loadContacts(accountId);
  };

  const filtered = contacts.filter((c) => {
    const q = search.toLowerCase();
    return (
      c.displayName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      c.jobTitle.toLowerCase().includes(q)
    );
  });

  const handleCopy = () => {
    const text = filtered.map((c) => `${c.displayName}\t${c.email}\t${c.companyName}\t${c.jobTitle}`).join("\n");
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: "json" | "csv") => {
    let content: string;
    let mime: string;
    let ext: string;

    if (format === "json") {
      content = JSON.stringify(filtered, null, 2);
      mime = "application/json";
      ext = "json";
    } else {
      content =
        "name,email,company,title\n" +
        filtered
          .map(
            (c) =>
              `"${c.displayName}","${c.email}","${c.companyName}","${c.jobTitle}"`
          )
          .join("\n");
      mime = "text/csv";
      ext = "csv";
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contacts-${selectedAccountId.slice(0, 8)}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <Users className="h-7 w-7" />
        {t("contacts")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("contacts")}</CardTitle>
          <CardDescription>{t("contactsDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                {t("accounts")}
              </label>
              <Select value={selectedAccountId} onValueChange={(v) => v && handleAccountChange(v)}>
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

            {contacts.length > 0 && (
              <div className="flex-1 min-w-[180px]">
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {t("search")}
                </label>
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search")}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingText className="text-muted-foreground" />
        </div>
      )}

      {!loading && contacts.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CardTitle>{t("contacts")}</CardTitle>
                <Badge variant="secondary">
                  {t("contactsTotal", { count: String(filtered.length) })}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1 h-3 w-3" />
                  {copied ? t("copied") : t("copyToClipboard")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload("json")}>
                  <Download className="mr-1 h-3 w-3" />
                  {t("downloadJson")}
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDownload("csv")}>
                  <Download className="mr-1 h-3 w-3" />
                  {t("downloadCsv")}
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t("noResults")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("email")}</TableHead>
                      <TableHead>{t("extractFieldCompany")}</TableHead>
                      <TableHead>{t("extractFieldTitle")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((contact, idx) => (
                      <TableRow key={contact.email}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-medium">{contact.displayName || "—"}</TableCell>
                        <TableCell className="text-sm font-mono">{contact.email}</TableCell>
                        <TableCell className="text-sm">{contact.companyName || "—"}</TableCell>
                        <TableCell className="text-sm">{contact.jobTitle || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!loading && selectedAccountId && contacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("noResults")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
