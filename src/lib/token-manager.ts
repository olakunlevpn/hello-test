import { prisma } from "./prisma";
import { encrypt, decrypt } from "./encryption";
import type { LinkedAccount } from "@prisma/client";

const TOKEN_ENDPOINT = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// Core scopes for token refresh — Microsoft returns all previously consented scopes
// automatically, so we only need to request offline_access + the basics
const REFRESH_SCOPES = "offline_access User.Read Mail.Read Mail.ReadWrite Mail.Send Contacts.Read People.Read";

export function buildTokenRefreshBody(decryptedRefreshToken: string): string {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID!,
    client_secret: process.env.MICROSOFT_CLIENT_SECRET!,
    grant_type: "refresh_token",
    refresh_token: decryptedRefreshToken,
    scope: REFRESH_SCOPES,
  });
  return params.toString();
}

export async function refreshAccountToken(account: LinkedAccount): Promise<boolean> {
  try {
    const decryptedRefreshToken = decrypt(account.refreshToken);
    const body = buildTokenRefreshBody(decryptedRefreshToken);

    const response = await fetch(TOKEN_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });

    if (!response.ok) {
      await prisma.linkedAccount.update({
        where: { id: account.id },
        data: { status: "NEEDS_REAUTH" },
      });
      return false;
    }

    const tokens = await response.json();

    const encryptedAccessToken = encrypt(tokens.access_token);
    const encryptedRefreshToken = encrypt(tokens.refresh_token);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

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
  } catch {
    try {
      await prisma.linkedAccount.update({
        where: { id: account.id },
        data: { status: "NEEDS_REAUTH" },
      });
    } catch {
      // DB also failed — skip this account, don't crash the worker
    }
    return false;
  }
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
