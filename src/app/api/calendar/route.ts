import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function GET(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const now = new Date();
    const defaultEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const startDateTime = request.nextUrl.searchParams.get("startDateTime") || now.toISOString();
    const endDateTime = request.nextUrl.searchParams.get("endDateTime") || defaultEnd.toISOString();
    const events = await graph.getCalendarEvents(startDateTime, endDateTime);
    return NextResponse.json(events);
  } catch (err) {
    return safeError(err);
  }
}
