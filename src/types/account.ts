export type AccountStatusType = "ACTIVE" | "NEEDS_REAUTH" | "REVOKED";

export interface LinkedAccountInfo {
  id: string;
  microsoftUserId: string;
  email: string;
  displayName: string;
  status: AccountStatusType;
  lastRefreshedAt: string | null;
  createdAt: string;
}

export type StatusColor = "green" | "yellow" | "red";

export function getStatusColor(
  status: AccountStatusType,
  tokenExpiresAt?: string
): StatusColor {
  if (status === "NEEDS_REAUTH" || status === "REVOKED") return "red";
  if (
    tokenExpiresAt &&
    new Date(tokenExpiresAt).getTime() - Date.now() < 10 * 60 * 1000
  ) {
    return "yellow";
  }
  return "green";
}
