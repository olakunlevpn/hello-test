import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const { id } = await params;
  const body = await request.json();
  const { accountId, comment, replyAll } = body as { accountId: string; comment: string; replyAll?: boolean };
  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    if (replyAll) {
      await graph.replyAllToMessage(id, comment);
    } else {
      await graph.replyToMessage(id, comment);
    }
    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err);
  }
}
