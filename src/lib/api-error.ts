import { NextResponse } from "next/server";

/**
 * Return a safe error response — never leak internal error details to clients.
 * Logs the actual error server-side for debugging.
 */
export function safeError(err: unknown, status = 500): NextResponse {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;

  // Always log server-side
  console.error("[API_ERROR]", message);
  if (stack) console.error("[API_STACK]", stack);

  // Known safe errors that can be returned to client
  const safeMessages: Record<string, string> = {
    "TOKEN_EXPIRED": "Session expired",
    "ACCOUNT_NOT_FOUND": "Account not found",
    "UNAUTHORIZED": "Unauthorized",
    "FORBIDDEN": "Forbidden",
    "SUBSCRIPTION_REQUIRED": "Active subscription required",
  };

  const clientMessage = safeMessages[message] || "Something went wrong";

  return NextResponse.json({ error: clientMessage }, { status });
}
