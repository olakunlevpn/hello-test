"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Separator } from "@/components/ui/separator";
import { Check, Bitcoin } from "lucide-react";
import BitcoinPaymentDialog from "../../components/BitcoinPaymentDialog";
import { t } from "@/i18n";
import { LoadingText } from "@/components/ui/loading-text";
import type { SubscriptionInfo, PaymentInfo } from "@/types/billing";

export default function BillingPage() {
  const [subscription, setSubscription] = useState<SubscriptionInfo | null>(null);
  const [payments, setPayments] = useState<PaymentInfo[]>([]);
  const [prices, setPrices] = useState({ monthly: 29, yearly: 290 });
  const [selectedInterval, setSelectedInterval] = useState<"MONTHLY" | "YEARLY">("MONTHLY");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [features, setFeatures] = useState<{ id: string; text: string }[]>([]);

  const loadBilling = () => {
    fetch("/api/billing")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setSubscription(data.subscription);
        setPayments(data.payments || []);
        setPrices(data.prices);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  };

  useEffect(() => {
    loadBilling();
    fetch("/api/features")
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then((data) => {
        if (data?.features) setFeatures(data.features);
      })
      .catch(() => {});
  }, []);

  const yearlyDiscount = Math.round(
    (1 - prices.yearly / (prices.monthly * 12)) * 100
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <LoadingText className="text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">{t("billing")}</h1>

      {subscription && subscription.status === "ACTIVE" && (
        <Card className="border-green-600/50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{t("activeSubscription")}</CardTitle>
              <Badge className="bg-green-600">{t("statusActive")}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid gap-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("plan")}</span>
                <span>{subscription.plan === "MONTHLY" ? t("monthly") : t("yearly")}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{t("subscriptionExpires")}</span>
                <span>{new Date(subscription.currentPeriodEnd).toLocaleDateString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">{t("appName")} Pro</CardTitle>
          <CardDescription>{t("planFeatures")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex justify-center">
            <Tabs
              value={selectedInterval}
              onValueChange={(v) => setSelectedInterval(v as "MONTHLY" | "YEARLY")}
            >
              <TabsList>
                <TabsTrigger value="MONTHLY">{t("monthly")}</TabsTrigger>
                <TabsTrigger value="YEARLY">
                  {t("yearly")}{" "}
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {t("savePercent", { percent: String(yearlyDiscount) })}
                  </Badge>
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <div className="text-center">
            <span className="text-5xl font-bold">
              ${selectedInterval === "MONTHLY" ? prices.monthly : prices.yearly}
            </span>
            <span className="text-muted-foreground">
              {selectedInterval === "MONTHLY" ? t("perMonth") : t("perYear")}
            </span>
          </div>

          <Separator />

          <ul className="space-y-3">
            {features.map((feature) => (
              <li key={feature.id} className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{feature.text}</span>
              </li>
            ))}
          </ul>
        </CardContent>
        <CardFooter>
          <Button className="w-full" size="lg" onClick={() => setPaymentOpen(true)}>
            <Bitcoin className="mr-2 h-5 w-5" />
            {subscription?.status === "ACTIVE" ? t("subscriptionRenew") : t("subscribePlan")}
            {" — "}
            {t("payWithBitcoin")}
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("paymentHistory")}</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="py-8 text-center text-muted-foreground">{t("noPayments")}</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("date")}</TableHead>
                  <TableHead>{t("plan")}</TableHead>
                  <TableHead>{t("amountUSD")}</TableHead>
                  <TableHead>{t("amountBTC")}</TableHead>
                  <TableHead>{t("status")}</TableHead>
                  <TableHead>{t("txHash")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell>{new Date(payment.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell>{payment.planInterval}</TableCell>
                    <TableCell>${payment.amountUSD}</TableCell>
                    <TableCell>{payment.amountBTC}</TableCell>
                    <TableCell>
                      {payment.status === "CONFIRMED" ? (
                        <Badge className="bg-green-600">{t("paymentConfirmed")}</Badge>
                      ) : payment.status === "PENDING" ? (
                        <Badge variant="outline">{t("paymentPending")}</Badge>
                      ) : (
                        <Badge variant="secondary">{t("paymentExpired")}</Badge>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[120px] truncate text-xs">
                      {payment.txHash || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <BitcoinPaymentDialog
        open={paymentOpen}
        onClose={() => { setPaymentOpen(false); loadBilling(); }}
        planInterval={selectedInterval}
      />
    </div>
  );
}
