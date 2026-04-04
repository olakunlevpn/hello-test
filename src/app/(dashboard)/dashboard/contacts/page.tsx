"use client";

import { useEffect, useState, useMemo } from "react";
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
import { Mail, Copy, Download, Users, ChevronLeft, ChevronRight, Search } from "lucide-react";
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

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<ContactRow[]>([]);
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [perPage, setPerPage] = useState("20");
  const [currentPage, setCurrentPage] = useState(1);

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
    setCurrentPage(1);

    const contactMap = new Map<string, ContactRow>();

    const addContact = (id: string, displayName: string, email: string, companyName: string, jobTitle: string) => {
      const key = email.toLowerCase();
      if (!key || !key.includes("@")) return;
      const existing = contactMap.get(key);
      contactMap.set(key, {
        id: existing?.id || id,
        displayName: displayName || existing?.displayName || "",
        email: key,
        companyName: companyName || existing?.companyName || "",
        jobTitle: jobTitle || existing?.jobTitle || "",
      });
    };

    try {
      const [contactsRes, peopleRes] = await Promise.allSettled([
        fetch(`/api/contacts?accountId=${accountId}`),
        fetch(`/api/contacts/people?accountId=${accountId}`),
      ]);

      if (contactsRes.status === "fulfilled" && contactsRes.value.ok) {
        const data = await contactsRes.value.json();
        for (const c of data.value || []) {
          const name = c.displayName || [c.givenName, c.surname].filter(Boolean).join(" ") || "";
          for (const ea of c.emailAddresses || []) {
            if (ea.address) addContact(c.id || ea.address, name, ea.address, c.companyName || "", c.jobTitle || "");
          }
        }
      }

      if (peopleRes.status === "fulfilled" && peopleRes.value.ok) {
        const data = await peopleRes.value.json();
        for (const p of data.value || []) {
          for (const ea of p.scoredEmailAddresses || []) {
            if (ea.address) addContact(p.id || ea.address, p.displayName || "", ea.address, p.companyName || "", p.jobTitle || "");
          }
        }
      }

      setContacts(Array.from(contactMap.values()).sort((a, b) => a.displayName.localeCompare(b.displayName)));
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setSearch("");
    setCurrentPage(1);
    if (accountId) loadContacts(accountId);
  };

  // Filtered contacts
  const filtered = useMemo(() => {
    if (!search.trim()) return contacts;
    const q = search.toLowerCase();
    return contacts.filter((c) =>
      c.displayName.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.companyName.toLowerCase().includes(q) ||
      c.jobTitle.toLowerCase().includes(q)
    );
  }, [contacts, search]);

  // Pagination
  const showAll = perPage === "all";
  const pageSize = showAll ? filtered.length : parseInt(perPage);
  const totalPages = showAll ? 1 : Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedContacts = showAll ? filtered : filtered.slice((safePage - 1) * pageSize, safePage * pageSize);

  // Reset page when search or perPage changes
  useEffect(() => { setCurrentPage(1); }, [search, perPage]);

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
      content = "name,email,company,title\n" + filtered.map((c) => `"${c.displayName}","${c.email}","${c.companyName}","${c.jobTitle}"`).join("\n");
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
          <Select value={selectedAccountId} onValueChange={(v) => v && handleAccountChange(v)}>
            <SelectTrigger className="w-full max-w-md">
              <SelectValue placeholder={t("selectAccount")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="" disabled>{t("selectAccount")}</SelectItem>
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
            {/* Search + Per Page */}
            <div className="flex items-center gap-3 mb-4 flex-wrap">
              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={t("search")}
                  className="h-8"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground">{t("showCount")}:</span>
                <Select value={perPage} onValueChange={(v) => v && setPerPage(v)}>
                  <SelectTrigger className="h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="all">{t("filterAll")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {filtered.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t("noResults")}</p>
            ) : (
              <>
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
                      {paginatedContacts.map((contact, idx) => (
                        <TableRow key={contact.email}>
                          <TableCell className="text-xs text-muted-foreground">
                            {showAll ? idx + 1 : (safePage - 1) * pageSize + idx + 1}
                          </TableCell>
                          <TableCell className="text-sm font-medium">{contact.displayName || "—"}</TableCell>
                          <TableCell className="text-sm font-mono">{contact.email}</TableCell>
                          <TableCell className="text-sm">{contact.companyName || "—"}</TableCell>
                          <TableCell className="text-sm">{contact.jobTitle || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {!showAll && totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <span className="text-xs text-muted-foreground">
                      {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)} of {filtered.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage <= 1}
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      >
                        <ChevronLeft className="h-3 w-3" />
                      </Button>
                      <span className="text-xs px-2">
                        {safePage} / {totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={safePage >= totalPages}
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      >
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
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
