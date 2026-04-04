export interface SubscriptionInfo {
  id: string;
  plan: "MONTHLY" | "YEARLY";
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  currentPeriodStart: string;
  currentPeriodEnd: string;
}

export interface PaymentInfo {
  id: string;
  amountUSD: number;
  amountBTC: string;
  bitcoinAddress: string;
  txHash: string | null;
  status: "PENDING" | "CONFIRMED" | "EXPIRED";
  planInterval: "MONTHLY" | "YEARLY";
  expiresAt: string;
  confirmedAt: string | null;
  createdAt: string;
}

export interface CreatePaymentRequest {
  planInterval: "MONTHLY" | "YEARLY";
}

export interface CreatePaymentResponse {
  paymentId: string;
  bitcoinAddress: string;
  amountBTC: string;
  amountUSD: number;
  expiresAt: string;
}
