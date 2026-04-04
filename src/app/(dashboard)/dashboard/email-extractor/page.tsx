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
import {
  AtSign,
  Mail,
  Copy,
  Download,
  Search,
  Users,
  Building2,
  Briefcase,
} from "lucide-react";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface ExtractedContact {
  email: string;
  name: string;
  company: string;
  title: string;
}

export default function EmailExtractorPage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [source, setSource] = useState("all");
  const [separator, setSeparator] = useState("newline");
  const [exportFormat, setExportFormat] = useState("full");
  const [extracting, setExtracting] = useState(false);
  const [contacts, setContacts] = useState<ExtractedContact[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setAccounts(data.accounts || []); })
      .catch(() => {});
  }, [status]);

  const isAccountActive = (accountId: string) => {
    const account = accounts.find((a) => a.id === accountId);
    return account?.status === "ACTIVE";
  };

  const handleExtract = async () => {
    if (!selectedAccountId) return;
    if (!isAccountActive(selectedAccountId)) {
      toast.error(t("accountNotActive"));
      return;
    }
    setExtracting(true);
    setContacts([]);

    const contactMap = new Map<string, ExtractedContact>();

    const addContact = (email: string, name?: string, company?: string, title?: string) => {
      const key = email.toLowerCase();
      if (!key || !key.includes("@")) return;
      const existing = contactMap.get(key);
      contactMap.set(key, {
        email: key,
        name: name || existing?.name || "",
        company: company || existing?.company || "",
        title: title || existing?.title || "",
      });
    };

    try {
      // Contacts API — has name, company, jobTitle, emailAddresses
      if (source === "all" || source === "contacts") {
        try {
          const res = await fetch(`/api/contacts?accountId=${selectedAccountId}`);
          if (res.ok) {
            const data = await res.json();
            for (const contact of data.value || []) {
              const name = contact.displayName || [contact.givenName, contact.surname].filter(Boolean).join(" ") || "";
              for (const ea of contact.emailAddresses || []) {
                if (ea.address) {
                  addContact(ea.address, name, contact.companyName || "", contact.jobTitle || "");
                }
              }
            }
          }
        } catch { /* continue */ }

        // People API — has displayName, companyName, jobTitle, scoredEmailAddresses
        try {
          const res = await fetch(`/api/contacts/people?accountId=${selectedAccountId}`);
          if (res.ok) {
            const data = await res.json();
            for (const person of data.value || []) {
              for (const ea of person.scoredEmailAddresses || []) {
                if (ea.address) {
                  addContact(ea.address, person.displayName || "", person.companyName || "", person.jobTitle || "");
                }
              }
            }
          }
        } catch { /* continue */ }
      }

      // Inbox senders — has from.emailAddress.name and .address
      if (source === "all" || source === "inbox") {
        try {
          const res = await fetch(`/api/mail?accountId=${selectedAccountId}&top=100&orderby=receivedDateTime desc`);
          if (res.ok) {
            const data = await res.json();
            for (const msg of data.value || []) {
              if (msg.from?.emailAddress?.address) {
                addContact(msg.from.emailAddress.address, msg.from.emailAddress.name || "");
              }
            }
          }
        } catch { /* continue */ }
      }

      const sorted = Array.from(contactMap.values()).sort((a, b) => a.email.localeCompare(b.email));
      setContacts(sorted);
    } catch {
      setContacts([]);
    } finally {
      setExtracting(false);
    }
  };

  const getFormattedText = () => {
    if (exportFormat === "emailsOnly") {
      return separator === "comma"
        ? contacts.map((c) => c.email).join(", ")
        : contacts.map((c) => c.email).join("\n");
    }
    // Full format
    return contacts.map((c) => {
      const parts = [c.email, c.name, c.company, c.title].filter(Boolean);
      return separator === "comma" ? parts.join(", ") : parts.join(" | ");
    }).join("\n");
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(getFormattedText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: "json" | "csv" | "txt") => {
    let content: string;
    let mime: string;
    let ext: string;

    switch (format) {
      case "json":
        content = JSON.stringify(contacts, null, 2);
        mime = "application/json";
        ext = "json";
        break;
      case "csv":
        content = "email,name,company,title\n" + contacts.map((c) =>
          `"${c.email}","${c.name}","${c.company}","${c.title}"`
        ).join("\n");
        mime = "text/csv";
        ext = "csv";
        break;
      case "txt":
        content = getFormattedText();
        mime = "text/plain";
        ext = "txt";
        break;
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

  const totalWithName = contacts.filter((c) => c.name).length;
  const totalWithCompany = contacts.filter((c) => c.company).length;
  const totalWithTitle = contacts.filter((c) => c.title).length;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <AtSign className="h-7 w-7" />
        {t("emailExtractor")}
      </h1>

      {/* Controls */}
      <Card>
        <CardHeader>
          <CardTitle>{t("emailExtractor")}</CardTitle>
          <CardDescription>{t("extractSourceAll")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex-1 min-w-[200px] max-w-md">
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("accounts")}</label>
              <Select value={selectedAccountId} onValueChange={(v) => v && setSelectedAccountId(v)}>
                <SelectTrigger className="w-full">
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
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("extractSource")}</label>
              <Select value={source} onValueChange={(v) => v && setSource(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("extractSourceAll")}</SelectItem>
                  <SelectItem value="contacts">{t("extractSourceContacts")}</SelectItem>
                  <SelectItem value="inbox">{t("extractSourceInbox")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("extractExportFormat")}</label>
              <Select value={exportFormat} onValueChange={(v) => v && setExportFormat(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">{t("extractFull")}</SelectItem>
                  <SelectItem value="emailsOnly">{t("extractEmailsOnly")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{t("separatorNewline")}</label>
              <Select value={separator} onValueChange={(v) => v && setSeparator(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newline">{t("separatorNewline")}</SelectItem>
                  <SelectItem value="comma">{t("separatorComma")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={handleExtract}
              disabled={!selectedAccountId || extracting}
            >
              <Search className="mr-1 h-4 w-4" />
              {extracting ? t("extracting") : t("extractEmails")}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Results */}
      {(contacts.length > 0 || extracting) && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {t("extractedCount", { count: String(contacts.length) })}
                </CardTitle>
                {contacts.length > 0 && (
                  <div className="flex items-center gap-3 mt-2">
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="h-3 w-3" /> {totalWithName} {t("extractFieldName").toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="h-3 w-3" /> {totalWithCompany} {t("extractFieldCompany").toLowerCase()}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Briefcase className="h-3 w-3" /> {totalWithTitle} {t("extractFieldTitle").toLowerCase()}
                    </span>
                  </div>
                )}
              </div>
              {contacts.length > 0 && (
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
                  <Button variant="outline" size="sm" onClick={() => handleDownload("txt")}>
                    <Download className="mr-1 h-3 w-3" />
                    {t("downloadTxt")}
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {extracting ? (
              <div className="flex items-center justify-center py-12">
                <LoadingText className="text-muted-foreground" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8">#</TableHead>
                      <TableHead>{t("extractFieldEmail")}</TableHead>
                      <TableHead>{t("extractFieldName")}</TableHead>
                      <TableHead>{t("extractFieldCompany")}</TableHead>
                      <TableHead>{t("extractFieldTitle")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {contacts.map((contact, idx) => (
                      <TableRow key={contact.email}>
                        <TableCell className="text-xs text-muted-foreground">{idx + 1}</TableCell>
                        <TableCell className="text-sm font-mono">{contact.email}</TableCell>
                        <TableCell className="text-sm">{contact.name || "—"}</TableCell>
                        <TableCell className="text-sm">{contact.company || "—"}</TableCell>
                        <TableCell className="text-sm">{contact.title || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!extracting && contacts.length === 0 && selectedAccountId && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{t("noEmailsExtracted")}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
