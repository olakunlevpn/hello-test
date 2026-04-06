import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";
import type { LinkedAccount } from "@prisma/client";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

const PERMANENT_ERRORS = [
  "unauthorized_client",
  "interaction_required",
];

function buildTokenRefreshBody(decryptedRefreshToken: string, includeSecret: boolean): string {
  const scopes = process.env.MICROSOFT_SCOPES || "offline_access User.Read Mail.ReadWrite Mail.Send";

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    grant_type: "refresh_token",
    refresh_token: decryptedRefreshToken,
    scope: scopes,
  });

  if (includeSecret) {
    params.set("client_secret", process.env.MICROSOFT_CLIENT_SECRET!);
  }

  return params.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getIfAlreadyRefreshed(accountId: string): Promise<LinkedAccount | null> {
  const fresh = await prisma.linkedAccount.findUnique({ where: { id: accountId } });
  if (!fresh || fresh.status !== "ACTIVE") return null;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  if (fresh.lastRefreshedAt && fresh.lastRefreshedAt > twoMinutesAgo) {
    if (new Date(fresh.tokenExpiresAt) > new Date()) {
      return fresh;
    }
  }
  return null;
}

/**
 * Attempt a single token refresh. Tries with client_secret first (web OAuth),
 * then without (device code) if Microsoft rejects the secret.
 */
async function attemptRefresh(
  decryptedRefreshToken: string
): Promise<{ ok: true; tokens: Record<string, unknown> } | { ok: false; errorCode: string; errorDesc: string }> {
  for (const includeSecret of [true, false]) {
    const body = buildTokenRefreshBody(decryptedRefreshToken, includeSecret);

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (response.ok) {
      return { ok: true, tokens: await response.json() };
    }

    // Parse error
    let errorData: Record<string, string> = {};
    try { errorData = await response.json(); } catch { /* ignore */ }

    // AADSTS700025 = "Client is public, don't send client_secret"
    // Retry without secret
    if (includeSecret && errorData.error_description?.includes("AADSTS700025")) {
      continue;
    }

    // Any other error — return it
    return {
      ok: false,
      errorCode: errorData.error || `status_${response.status}`,
      errorDesc: `${response.status}: ${errorData.error || ""} - ${errorData.error_description || ""}`,
    };
  }

  return { ok: false, errorCode: "unknown", errorDesc: "All secret modes failed" };
}

export async function refreshAccountToken(account: LinkedAccount): Promise<boolean> {
  const alreadyRefreshed = await getIfAlreadyRefreshed(account.id);
  if (alreadyRefreshed) return true;

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
    try {
      const currentAccount = attempt === 1
        ? account
        : await prisma.linkedAccount.findUnique({ where: { id: account.id } });

      if (!currentAccount || currentAccount.status !== "ACTIVE") return false;

      const decryptedRefreshToken = decrypt(currentAccount.refreshToken);
      const result = await attemptRefresh(decryptedRefreshToken);

      if (result.ok) {
        const tokens = result.tokens as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
        };

        await prisma.linkedAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encrypt(tokens.access_token),
            refreshToken: tokens.refresh_token
              ? encrypt(tokens.refresh_token)
              : currentAccount.refreshToken,
            tokenExpiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000),
            lastRefreshedAt: new Date(),
            status: "ACTIVE",
          },
        });

        return true;
      }

      // Refresh failed
      lastError = result.errorDesc;
      const errorCode = result.errorCode;

      // invalid_grant — token might have been rotated by another process
      if (errorCode === "invalid_grant") {
        console.error(`[token-refresh] invalid_grant attempt ${attempt}/${MAX_REFRESH_RETRIES} for ${account.email}: ${lastError}`);
        const freshAccount = await getIfAlreadyRefreshed(account.id);
        if (freshAccount) return true;
        if (attempt < MAX_REFRESH_RETRIES) { await sleep(RETRY_DELAY_MS * attempt); continue; }
        break;
      }

      // Permanent errors — stop immediately
      if (PERMANENT_ERRORS.includes(errorCode)) {
        console.error(`[token-refresh] Permanent error for ${account.email}: ${lastError}`);
        await prisma.linkedAccount.update({
          where: { id: account.id },
          data: { status: "NEEDS_REAUTH" },
        });
        return false;
      }

      // Transient error — retry
      console.error(`[token-refresh] Attempt ${attempt}/${MAX_REFRESH_RETRIES} failed for ${account.email}: ${lastError}`);
      if (attempt < MAX_REFRESH_RETRIES) { await sleep(RETRY_DELAY_MS * attempt); }
    } catch (err) {
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[token-refresh] Attempt ${attempt}/${MAX_REFRESH_RETRIES} exception for ${account.email}: ${lastError}`);
      if (attempt < MAX_REFRESH_RETRIES) { await sleep(RETRY_DELAY_MS * attempt); }
    }
  }

  console.error(`[token-refresh] All ${MAX_REFRESH_RETRIES} attempts failed for ${account.email}: ${lastError}`);
  try {
    await prisma.linkedAccount.update({
      where: { id: account.id },
      data: { status: "NEEDS_REAUTH" },
    });
  } catch { /* DB failed too */ }
  return false;
}

export async function getAccountsNeedingRefresh(): Promise<LinkedAccount[]> {
  const thirtyMinutesFromNow = new Date(Date.now() + 30 * 60 * 1000);
  return prisma.linkedAccount.findMany({
    where: {
      status: "ACTIVE",
      tokenExpiresAt: { lte: thirtyMinutesFromNow },
    },
  });
}
