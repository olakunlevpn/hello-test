"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
  HardDrive,
  Folder,
  FileText,
  Download,
  ExternalLink,
  ChevronRight,
  Mail,
} from "lucide-react";
import { t } from "@/i18n";
import { translateError } from "@/lib/error-messages";
import { LoadingText } from "@/components/ui/loading-text";

interface Account {
  id: string;
  email: string;
  displayName: string;
  status: string;
}

interface DriveItem {
  id: string;
  name: string;
  size: number;
  lastModifiedDateTime: string;
  folder?: { childCount: number };
  file?: { mimeType: string };
  webUrl: string;
}

interface BreadcrumbEntry {
  id: string | null;
  name: string;
}

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function OneDrivePage() {
  const { data: session, status } = useSession();
  const hasActiveSubscription = (session?.user as { hasActiveSubscription?: boolean })?.hasActiveSubscription;
  const role = (session?.user as { role?: string })?.role;
  const canAccess = hasActiveSubscription || role === "ADMIN";

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbEntry[]>([
    { id: null, name: t("oneDriveRoot") },
  ]);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetch("/api/accounts")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAccounts((data.accounts || []).filter((a: Account) => a.status === "ACTIVE"));
      })
      .catch(() => {});
  }, [status]);

  const loadFolder = async (accountId: string, folderId: string | null) => {
    setLoading(true);
    setItems([]);
    setHasLoaded(false);

    try {
      const url = folderId
        ? `/api/drive?accountId=${accountId}&folderId=${folderId}`
        : `/api/drive?accountId=${accountId}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        return;
      }

      setItems(data.value || []);
    } catch {
      toast.error(t("error"));
    } finally {
      setLoading(false);
      setHasLoaded(true);
    }
  };

  const handleAccountChange = (accountId: string) => {
    setSelectedAccountId(accountId);
    setBreadcrumbs([{ id: null, name: t("oneDriveRoot") }]);
    setItems([]);
    setHasLoaded(false);
    if (accountId) loadFolder(accountId, null);
  };

  const handleFolderClick = (item: DriveItem) => {
    setBreadcrumbs((prev) => [...prev, { id: item.id, name: item.name }]);
    loadFolder(selectedAccountId, item.id);
  };

  const handleBreadcrumbClick = (index: number) => {
    const crumb = breadcrumbs[index];
    setBreadcrumbs((prev) => prev.slice(0, index + 1));
    loadFolder(selectedAccountId, crumb.id);
  };

  const handleDownload = async (item: DriveItem) => {
    setDownloadingId(item.id);
    try {
      const res = await fetch(`/api/drive/${item.id}/download?accountId=${selectedAccountId}`);
      const data = await res.json();

      if (!res.ok || data.error) {
        toast.error(translateError(data.error));
        return;
      }

      if (data.downloadUrl) {
        window.open(data.downloadUrl, "_blank");
      }
    } catch {
      toast.error(t("error"));
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold flex items-center gap-2">
        <HardDrive className="h-7 w-7" />
        {t("oneDrive")}
      </h1>

      <Card>
        <CardHeader>
          <CardTitle>{t("oneDrive")}</CardTitle>
          <CardDescription>{t("oneDriveDescription")}</CardDescription>
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

      {!loading && hasLoaded && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-1 flex-wrap text-sm">
              {breadcrumbs.map((crumb, idx) => (
                <span key={idx} className="flex items-center gap-1">
                  {idx > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                  {idx < breadcrumbs.length - 1 ? (
                    <button
                      onClick={() => handleBreadcrumbClick(idx)}
                      className="text-primary hover:underline font-medium"
                    >
                      {crumb.name}
                    </button>
                  ) : (
                    <span className="font-semibold">{crumb.name}</span>
                  )}
                </span>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">{t("oneDriveNoFiles")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("name")}</TableHead>
                      <TableHead>{t("oneDriveSize")}</TableHead>
                      <TableHead>{t("oneDriveModified")}</TableHead>
                      <TableHead>{t("actions")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell>
                          {item.folder ? (
                            <button
                              onClick={() => handleFolderClick(item)}
                              className="flex items-center gap-2 text-sm font-medium hover:underline text-primary"
                            >
                              <Folder className="h-4 w-4 shrink-0" />
                              {item.name}
                            </button>
                          ) : (
                            <div className="flex items-center gap-2 text-sm font-medium">
                              <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                              {item.name}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {item.folder ? "—" : formatSize(item.size)}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                          {formatDate(item.lastModifiedDateTime)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {item.webUrl && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => window.open(item.webUrl, "_blank")}
                              >
                                <ExternalLink className="mr-1 h-3 w-3" />
                                {t("oneDriveOpen")}
                              </Button>
                            )}
                            {item.file && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={downloadingId === item.id}
                                onClick={() => handleDownload(item)}
                              >
                                <Download className="mr-1 h-3 w-3" />
                                {downloadingId === item.id ? t("loading") : t("oneDriveDownload")}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
