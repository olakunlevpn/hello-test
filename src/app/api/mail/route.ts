import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") {
      return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const params = request.nextUrl.searchParams;
  const accountId = params.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const messages = await graph.getMessages({
      folderId: params.get("folderId") || undefined,
      filter: params.get("filter") || undefined,
      search: params.get("search") || undefined,
      top: params.get("top") ? Number(params.get("top")) : 25,
      skip: params.get("skip") ? Number(params.get("skip")) : undefined,
      orderby: params.get("orderby") || "receivedDateTime desc",
      select: "id,subject,bodyPreview,from,receivedDateTime,isRead,importance,hasAttachments,flag",
      nextLink: params.get("nextLink") || undefined,
    });
    return NextResponse.json(messages);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message === "TOKEN_EXPIRED") return NextResponse.json({ error: "Token expired" }, { status: 401 });
    return safeError(err);
  }
}
