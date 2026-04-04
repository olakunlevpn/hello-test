const isTestMode = process.env.BITGO_IS_TEST_MODE === "true";
const BASE_URL = isTestMode
  ? "https://app.bitgo-test.com"
  : "https://app.bitgo.com";
const COIN = isTestMode ? "tbtc" : "btc";

function getApiKey(): string {
  const key = process.env.BITGO_API_KEY;
  if (!key) {
    throw new Error("BITGO_API_KEY is not configured");
  }
  return key;
}

function getWalletId(): string {
  const id = process.env.BITGO_WALLET_ID;
  if (!id) {
    throw new Error("BITGO_WALLET_ID is not configured");
  }
  return id;
}

export async function generatePaymentAddress(): Promise<string> {
  const apiKey = getApiKey();
  const walletId = getWalletId();

  const response = await fetch(
    `${BASE_URL}/api/v2/${COIN}/wallet/${walletId}/address`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        label: `payment-${Date.now()}`,
      }),
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `BitGo address generation failed (${response.status}): ${errorBody}`
    );
  }

  const data = await response.json();
  return data.address;
}

// Cache BTC price for 5 minutes to avoid CoinGecko rate limits
let cachedBTCPrice: { price: number; fetchedAt: number } | null = null;
const BTC_PRICE_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getBTCPriceUSD(): Promise<number> {
  if (
    cachedBTCPrice &&
    Date.now() - cachedBTCPrice.fetchedAt < BTC_PRICE_CACHE_TTL
  ) {
    return cachedBTCPrice.price;
  }

  // Try BitGo market data first (more reliable, already authenticated)
  try {
    const apiKey = getApiKey();
    const bitgoRes = await fetch(
      `${BASE_URL}/api/v2/market/latest?coin=${COIN}`,
      { headers: { Authorization: `Bearer ${apiKey}` } }
    );
    if (bitgoRes.ok) {
      const bitgoData = await bitgoRes.json();
      const usdPrice = bitgoData?.marketData?.[0]?.currencies?.USD?.last;
      if (usdPrice && usdPrice > 0) {
        cachedBTCPrice = { price: usdPrice, fetchedAt: Date.now() };
        return usdPrice;
      }
    }
  } catch {
    // Fall through to CoinGecko
  }

  // Fallback to CoinGecko
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (response.ok) {
      const data = await response.json();
      if (data?.bitcoin?.usd) {
        cachedBTCPrice = { price: data.bitcoin.usd, fetchedAt: Date.now() };
        return data.bitcoin.usd;
      }
    }
  } catch {
    // Fall through
  }

  if (cachedBTCPrice) return cachedBTCPrice.price;
  throw new Error("Failed to fetch BTC price");
}

export function usdToBTC(usdAmount: number, btcPriceUSD: number): string {
  if (btcPriceUSD <= 0) {
    throw new Error("Invalid BTC price");
  }
  const btcAmount = usdAmount / btcPriceUSD;
  return btcAmount.toFixed(8);
}

export function getRequiredConfirmations(): number {
  return Number(process.env.BITGO_REQUIRED_CONFIRMATIONS) || 2;
}
