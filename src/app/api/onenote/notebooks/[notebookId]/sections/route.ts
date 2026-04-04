import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ notebookId: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { notebookId } = await params;
  const accountId = request.nextUrl.searchParams.get("accountId");
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const sections = await graph.getNotebookSections(notebookId);
    return NextResponse.json(sections);
  } catch (err) {
    return safeError(err);
  }
}
