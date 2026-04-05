import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";
import type { LinkedAccount } from "@prisma/client";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

const MAX_REFRESH_RETRIES = 3;
const RETRY_DELAY_MS = 2000;

// Errors that indicate the token itself is invalid — no point retrying
const PERMANENT_ERRORS = [
  "invalid_grant",       // Refresh token revoked or expired
  "invalid_client",      // Wrong client_id/secret or public client token
  "unauthorized_client",
  "interaction_required", // User must re-authenticate
];

export function buildTokenRefreshBody(decryptedRefreshToken: string): string {
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

export async function refreshAccountToken(account: LinkedAccount): Promise<boolean> {
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_REFRESH_RETRIES; attempt++) {
    try {
      const decryptedRefreshToken = decrypt(account.refreshToken);
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
          : account.refreshToken;
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

      // Permanent error — don't retry, mark NEEDS_REAUTH immediately
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
