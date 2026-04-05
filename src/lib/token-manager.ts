import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";
import type { LinkedAccount } from "@prisma/client";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Errors that indicate the token itself is invalid — no point retrying
// NOTE: invalid_grant is handled separately with a DB re-read before giving up
const PERMANENT_ERRORS = [
  "invalid_client",      // Wrong client_id/secret
  "unauthorized_client",
  "interaction_required", // User must re-authenticate
];

function buildTokenRefreshBody(decryptedRefreshToken: string): string {
  // Use the same scopes from initial authorization so the refreshed access token
  // retains ALL permissions. Per Microsoft docs, scope must be "equivalent to or
  // a subset of" the originally consented scopes.
  const scopes = process.env.MICROSOFT_SCOPES || "offline_access User.Read Mail.ReadWrite Mail.Send";

  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: decryptedRefreshToken,
    scope: scopes,
  });
  return params.toString();
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if another process already refreshed this account recently.
 * Returns the fresh account if it was refreshed within the last 2 minutes
 * and the token is still valid, otherwise null.
 */
async function getIfAlreadyRefreshed(accountId: string): Promise<LinkedAccount | null> {
  const fresh = await prisma.linkedAccount.findUnique({ where: { id: accountId } });
  if (!fresh || fresh.status !== "ACTIVE") return null;

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
  if (fresh.lastRefreshedAt && fresh.lastRefreshedAt > twoMinutesAgo) {
    // Another process refreshed recently — token should be good
    if (new Date(fresh.tokenExpiresAt) > new Date()) {
      return fresh;
    }
  }
  return null;
}

export async function refreshAccountToken(account: LinkedAccount): Promise<boolean> {
  // Before doing anything, check if another process already refreshed this account
  const alreadyRefreshed = await getIfAlreadyRefreshed(account.id);
  if (alreadyRefreshed) {
    return true;
  }

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
    try {
      // Re-read from DB on retry to get the latest refresh token
      // (another process might have rotated it between attempts)
      const currentAccount = attempt === 1
        ? account
        : await prisma.linkedAccount.findUnique({ where: { id: account.id } });

      if (!currentAccount || currentAccount.status !== "ACTIVE") {
        return false;
      }

      const decryptedRefreshToken = decrypt(currentAccount.refreshToken);
      const body = buildTokenRefreshBody(decryptedRefreshToken);

      const response = await fetch(TOKEN_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      });

      if (response.ok) {
        const tokens = await response.json();

        const encryptedAccessToken = encrypt(tokens.access_token);
        // Microsoft returns a new refresh_token only if offline_access was requested.
        // If missing, keep the existing one.
        const encryptedRefreshToken = tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : currentAccount.refreshToken;
        const tokenExpiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

        await prisma.linkedAccount.update({
          where: { id: account.id },
          data: {
            accessToken: encryptedAccessToken,
            refreshToken: encryptedRefreshToken,
            tokenExpiresAt,
            lastRefreshedAt: new Date(),
            status: "ACTIVE",
          },
        });

        return true;
      }

      // Parse error response
      let errorCode = "";
      try {
        const errorData = await response.json();
        errorCode = errorData.error || "";
        lastError = `${response.status}: ${errorCode} - ${errorData.error_description || ""}`;
      } catch {
        lastError = `${response.status}: Unknown error`;
      }

      // invalid_grant — the refresh token might have been rotated by another process.
      // Re-read from DB and retry instead of immediately marking NEEDS_REAUTH.
      if (errorCode === "invalid_grant") {
        console.error(`[token-refresh] invalid_grant attempt ${attempt}/${MAX_REFRESH_RETRIES} for ${account.email}: ${lastError}`);

        // Check if another process already succeeded
        const freshAccount = await getIfAlreadyRefreshed(account.id);
        if (freshAccount) {
          return true; // Another process already handled it
        }

        if (attempt < MAX_REFRESH_RETRIES) {
          await sleep(RETRY_DELAY_MS * attempt);
          continue; // Retry with fresh token from DB (re-read happens at top of loop)
        }
        // All retries exhausted with invalid_grant — truly dead
        break;
      }

      // Other permanent errors — don't retry
      if (PERMANENT_ERRORS.includes(errorCode)) {
        console.error(`[token-refresh] Permanent error for ${account.email}: ${lastError}`);
        await prisma.linkedAccount.update({
          where: { id: account.id },
          data: { status: "NEEDS_REAUTH" },
        });
        return false;
      }

      // Transient error — retry after delay
      console.error(`[token-refresh] Attempt ${attempt}/${MAX_REFRESH_RETRIES} failed for ${account.email}: ${lastError}`);
      if (attempt < MAX_REFRESH_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    } catch (err) {
      // Network/runtime error — retry
      lastError = err instanceof Error ? err.message : "Unknown error";
      console.error(`[token-refresh] Attempt ${attempt}/${MAX_REFRESH_RETRIES} exception for ${account.email}: ${lastError}`);
      if (attempt < MAX_REFRESH_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  // All retries exhausted — NOW mark NEEDS_REAUTH
  console.error(`[token-refresh] All ${MAX_REFRESH_RETRIES} attempts failed for ${account.email}: ${lastError}`);
  try {
    await prisma.linkedAccount.update({
      where: { id: account.id },
      data: { status: "NEEDS_REAUTH" },
    });
  } catch {
    // DB failed too — don't crash
  }
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
