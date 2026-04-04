"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { sanitizeHtml } from "@/lib/sanitize";
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
import { StickyNote, Book, Layers, FileText, ArrowLeft, Mail } from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface Notebook {
  id: string;
  displayName: string;
  lastModifiedDateTime: string;
  isDefault: boolean;
}

interface Section {
  id: string;
  displayName: string;
  lastModifiedDateTime: string;
}

interface NotePage {
  id: string;
  title: string;
  lastModifiedDateTime: string;
}

type View = "notebooks" | "sections" | "pages" | "content";

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OneNotePage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<View>("notebooks");
  const [notebooks, setNotebooks] = useState<Notebook[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [pages, setPages] = useState<NotePage[]>([]);
  const [pageContent, setPageContent] = useState<string>("");

  const [selectedNotebook, setSelectedNotebook] = useState<Notebook | null>(null);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [selectedPage, setSelectedPage] = useState<NotePage | null>(null);

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

  const loadNotebooks = async (accountId: string) => {
    setLoading(true);
    setNotebooks([]);
    setSections([]);
    setPages([]);
    setPageContent("");
    setSelectedNotebook(null);
    setSelectedSection(null);
    setSelectedPage(null);
    setView("notebooks");
    setHasLoaded(false);

    try {
      const res = await fetch(`/api/onenote/notebooks?accountId=${accountId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        return;
      }

      setNotebooks(data.value || []);
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    if (accountId) loadNotebooks(accountId);
  };

  const handleNotebookClick = async (notebook: Notebook) => {
    setSelectedNotebook(notebook);
    setView("sections");
    setLoading(true);
    setSections([]);

    try {
      const res = await fetch(
        `/api/onenote/notebooks/${notebook.id}/sections?accountId=${selectedAccountId}`
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        setView("notebooks");
        return;
      }

      setSections(data.value || []);
    } catch {
      toast.error(t("error"));
      setView("notebooks");
    } finally {
      setLoading(false);
    }
  };

  const handleSectionClick = async (section: Section) => {
    setSelectedSection(section);
    setView("pages");
    setLoading(true);
    setPages([]);

    try {
      const res = await fetch(
        `/api/onenote/sections/${section.id}/pages?accountId=${selectedAccountId}`
      );
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        setView("sections");
        return;
      }

      setPages(data.value || []);
    } catch {
      toast.error(t("error"));
      setView("sections");
    } finally {
      setLoading(false);
    }
  };

  const handlePageClick = async (page: NotePage) => {
    setSelectedPage(page);
    setView("content");
    setLoading(true);
    setPageContent("");

    try {
      const res = await fetch(
        `/api/onenote/pages/${page.id}/content?accountId=${selectedAccountId}`
      );
      const text = await res.text();

      if (!res.ok) {
        let errMsg = t("error");
        try {
          const parsed = JSON.parse(text);
          if (parsed.error) errMsg = translateError(parsed.error);
        } catch {
          // not JSON
        }
        toast.error(errMsg);
        setView("pages");
        return;
      }

      setPageContent(text);
    } catch {
      toast.error(t("error"));
      setView("pages");
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    if (view === "content") {
      setView("pages");
      setSelectedPage(null);
      setPageContent("");
    } else if (view === "pages") {
      setView("sections");
      setSelectedSection(null);
      setPages([]);
    } else if (view === "sections") {
      setView("notebooks");
      setSelectedNotebook(null);
      setSections([]);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <StickyNote className="h-7 w-7" />
        {t("oneNote")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("oneNote")}</CardTitle>
          <CardDescription>{t("oneNoteDescription")}</CardDescription>
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
          </div>
        </CardContent>
      </Card>

      {loading && (
        <div className="flex items-center justify-center py-16">
          <LoadingText className="text-muted-foreground" />
        </div>
      )}

      {/* Back button for drill-down levels */}
      {!loading && view !== "notebooks" && (
        <div>
          <Button variant="outline" size="sm" onClick={goBack}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            {t("back")}
          </Button>
        </div>
      )}

      {/* Notebooks list */}
      {!loading && view === "notebooks" && hasLoaded && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Book className="h-5 w-5" />
            {t("oneNoteNotebooks")}
          </h2>
          {notebooks.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">{t("oneNoteNoNotebooks")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notebooks.map((nb) => (
                <Card
                  key={nb.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleNotebookClick(nb)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-sm font-semibold leading-snug">
                        {nb.displayName}
                      </CardTitle>
                      {nb.isDefault && (
                        <Badge variant="secondary" className="text-xs shrink-0">
                          Default
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(nb.lastModifiedDateTime)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Sections list */}
      {!loading && view === "sections" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Layers className="h-5 w-5" />
            {t("oneNoteSections")}
            {selectedNotebook && (
              <span className="text-muted-foreground font-normal text-base">
                — {selectedNotebook.displayName}
              </span>
            )}
          </h2>
          {sections.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">{t("oneNoteNoSections")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sections.map((sec) => (
                <Card
                  key={sec.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handleSectionClick(sec)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold leading-snug flex items-center gap-2">
                      <Layers className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {sec.displayName}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(sec.lastModifiedDateTime)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pages list */}
      {!loading && view === "pages" && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {t("oneNotePages")}
            {selectedSection && (
              <span className="text-muted-foreground font-normal text-base">
                — {selectedSection.displayName}
              </span>
            )}
          </h2>
          {pages.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">{t("oneNoteNoPages")}</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {pages.map((page) => (
                <Card
                  key={page.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => handlePageClick(page)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold leading-snug flex items-center gap-2">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      {page.title || "—"}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-xs text-muted-foreground">
                      {formatDate(page.lastModifiedDateTime)}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Page content */}
      {!loading && view === "content" && selectedPage && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-5 w-5" />
              {selectedPage.title || "—"}
            </CardTitle>
            <CardDescription>{formatDate(selectedPage.lastModifiedDateTime)}</CardDescription>
          </CardHeader>
          <CardContent>
            {pageContent ? (
              <div
                className="prose prose-invert max-w-none text-sm"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(pageContent) }}
              />
            ) : (
              <p className="text-muted-foreground text-sm">{t("oneNoteNoPages")}</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
