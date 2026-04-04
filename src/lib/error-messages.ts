import { t } from "@/i18n";

const errorMap: Record<string, () => string> = {
  "Unauthorized": () => t("errorUnauthorized"),
  "Active subscription required": () => t("errorSubscriptionRequired"),
  "Not found": () => t("errorNotFound"),
  "ACCOUNT_NOT_FOUND": () => t("errorAccountNotFound"),
  "TOKEN_EXPIRED": () => t("tokenExpired"),
  "Webhook creation failed": () => t("errorWebhookFailed"),
  "accountId is required": () => t("errorAccountIdRequired"),
  "name is required": () => t("errorInvalidInput"),
  "user_email is required": () => t("errorInvalidInput"),
  "access_token and refresh_token are required": () => t("errorInvalidInput"),
  "At least one condition is required": () => t("errorInvalidInput"),
  "At least one action is required": () => t("errorInvalidInput"),
  "displayName is required": () => t("errorInvalidInput"),
  "SUBSCRIPTION_REQUIRED": () => t("errorSubscriptionRequired"),
  "UNAUTHORIZED": () => t("errorUnauthorized"),
  "FORBIDDEN": () => t("forbidden"),
};

export function translateError(apiError: string | undefined | null): string {
  if (!apiError) return t("error");
  const mapped = errorMap[apiError];
  if (mapped) return mapped();
  // Check partial matches for Graph API errors
  if (apiError.includes("Graph API error")) return t("error");
  if (apiError.includes("Token expired")) return t("tokenExpired");
  return t("error");
}
