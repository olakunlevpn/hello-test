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
  const { accountId, destinationId } = body as { accountId: string; destinationId: string };
  if (!accountId || !destinationId) return NextResponse.json({ error: "accountId and destinationId are required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const moved = await graph.moveMessage(id, destinationId);
    return NextResponse.json(moved);
  } catch (err) {
    return safeError(err);
  }
}
