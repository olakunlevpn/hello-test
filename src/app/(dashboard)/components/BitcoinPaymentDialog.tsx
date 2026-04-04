"use client";

import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Copy, Check, Clock, Loader2 } from "lucide-react";
import QRCode from "qrcode";
import { t } from "@/i18n";

interface BitcoinPaymentDialogProps {
  open: boolean;
  onClose: () => void;
  planInterval: "MONTHLY" | "YEARLY";
}

interface PaymentData {
  paymentId: string;
  bitcoinAddress: string;
  amountBTC: string;
  amountUSD: number;
  expiresAt: string;
}

export default function BitcoinPaymentDialog({
  open,
  onClose,
  planInterval,
}: BitcoinPaymentDialogProps) {
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!open) return;
    setLoading(true);

    fetch("/api/billing/create-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planInterval }),
    })
      .then((r) => {
        if (!r.ok) return null;
        return r.json();
      })
      .then(async (data) => {
        if (!data || !data.bitcoinAddress) {
          setLoading(false);
          return;
        }
        setPayment(data);
        const qr = await QRCode.toDataURL(
          `bitcoin:${data.bitcoinAddress}?amount=${data.amountBTC}`,
          { width: 200, margin: 2, color: { dark: "#ffffff", light: "#00000000" } }
        );
        setQrDataUrl(qr);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, planInterval]);

  useEffect(() => {
    if (!payment) return;
    const interval = setInterval(() => {
      const diff = new Date(payment.expiresAt).getTime() - Date.now();
      if (diff <= 0) {
        setTimeLeft("Expired");
        clearInterval(interval);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${mins}:${secs.toString().padStart(2, "0")}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [payment]);

  const copyAddress = () => {
    if (!payment) return;
    navigator.clipboard.writeText(payment.bitcoinAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("payWithBitcoin")}</DialogTitle>
          <DialogDescription>{t("sendBitcoin")}</DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : payment ? (
          <div className="space-y-6">
            <div className="flex justify-center">
              {qrDataUrl && (
                <img src={qrDataUrl} alt="Bitcoin QR" className="rounded-lg" />
              )}
            </div>

            <div className="space-y-2 text-center">
              <div className="text-2xl font-bold">{payment.amountBTC} BTC</div>
              <div className="text-sm text-muted-foreground">
                ≈ ${payment.amountUSD} USD
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">{t("bitcoinAddress")}</label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted p-2 text-xs break-all">
                  {payment.bitcoinAddress}
                </code>
                <Button variant="outline" size="sm" onClick={copyAddress}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                {timeLeft === "Expired" ? t("paymentExpired") : timeLeft}
              </span>
            </div>

            <div className="flex items-center justify-center">
              <Badge variant="outline" className="gap-1">
                <Loader2 className="h-3 w-3 animate-spin" />
                {t("waitingForPayment")}
              </Badge>
            </div>
          </div>
        ) : (
          <div className="py-8 text-center text-destructive">{t("error")}</div>
        )}
      </DialogContent>
    </Dialog>
  );
}
