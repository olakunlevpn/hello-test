"use client";

import { useEffect, useState, useCallback } from "react";
import { LoadingText } from "@/components/ui/loading-text";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "@/i18n";

interface PaymentRow {
  id: string;
  plan: string;
  amountUSD: number;
  amountBTC: number;
  bitcoinAddress: string;
  status: string;
  txHash: string | null;
  createdAt: string;
  user: { id: string; email: string; name: string | null };
}

interface PaymentsResponse {
  payments: PaymentRow[];
  total: number;
  page: number;
  totalPages: number;
}

type StatusFilter = "ALL" | "PENDING" | "CONFIRMED" | "EXPIRED";

function paymentStatusBadge(status: string) {
  switch (status) {
    case "CONFIRMED":
      return <Badge className="bg-green-600">{t("paymentConfirmed")}</Badge>;
    case "PENDING":
      return <Badge variant="outline" className="text-yellow-500">{t("paymentPending")}</Badge>;
    case "EXPIRED":
      return <Badge variant="destructive">{t("paymentExpired")}</Badge>;
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

export default function AdminPaymentsPage() {
  const [data, setData] = useState<PaymentsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [activating, setActivating] = useState<string | null>(null);

  const loadPayments = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (statusFilter !== "ALL") params.set("status", statusFilter);
    fetch(`/api/admin/payments?${params}`)
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((d) => {
        if (!d) { setLoading(false); return; }
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, statusFilter]);

  useEffect(() => {
    loadPayments();
  }, [loadPayments]);

  const handleTabChange = (value: string) => {
    setStatusFilter(value as StatusFilter);
    setPage(1);
  };

  const handleActivate = async (paymentId: string) => {
    if (!confirm(t("activatePaymentConfirm"))) return;
    setActivating(paymentId);
    try {
      const res = await fetch(`/api/admin/payments/${paymentId}/activate`, { method: "POST" });
      if (res.ok) loadPayments();
    } catch {
      // silently handle
    }
    setActivating(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("adminPayments")}</h1>

      <Tabs value={statusFilter} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="ALL">{t("viewAll")}</TabsTrigger>
          <TabsTrigger value="PENDING">{t("paymentPending")}</TabsTrigger>
          <TabsTrigger value="CONFIRMED">{t("paymentConfirmed")}</TabsTrigger>
          <TabsTrigger value="EXPIRED">{t("paymentExpired")}</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle>
            {data ? t("totalOf", { count: String(data.total) }) : t("loading")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground"><LoadingText className="text-muted-foreground" /></div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("adminUsers")}</TableHead>
                    <TableHead>{t("plan")}</TableHead>
                    <TableHead>{t("amountUSD")}</TableHead>
                    <TableHead>{t("amountBTC")}</TableHead>
                    <TableHead>{t("bitcoinAddress")}</TableHead>
                    <TableHead>{t("status")}</TableHead>
                    <TableHead>{t("txHash")}</TableHead>
                    <TableHead>{t("date")}</TableHead>
                    <TableHead>{t("actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.payments.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{payment.user.email}</p>
                          {payment.user.name && (
                            <p className="text-xs text-muted-foreground">{payment.user.name}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{payment.plan}</TableCell>
                      <TableCell>${Number(payment.amountUSD).toFixed(2)}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {Number(payment.amountBTC).toFixed(8)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {payment.bitcoinAddress
                          ? `${payment.bitcoinAddress.slice(0, 10)}...`
                          : "—"}
                      </TableCell>
                      <TableCell>{paymentStatusBadge(payment.status)}</TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {payment.txHash
                          ? `${payment.txHash.slice(0, 8)}...`
                          : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(payment.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        {(payment.status === "PENDING" || payment.status === "EXPIRED") && (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={activating === payment.id}
                            onClick={() => handleActivate(payment.id)}
                          >
                            {activating === payment.id ? t("loading") : t("activatePayment")}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!data?.payments || data.payments.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground"
                      >
                        {t("noResults")}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>

              {data && data.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {t("pageOf", { page: String(data.page), total: String(data.totalPages) })}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      {t("previous")}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= data.totalPages}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      {t("next")}
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
