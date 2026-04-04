import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";
import type { ComposeEmailPayload } from "@/types/mail";

export async function POST(request: NextRequest) {
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

  try {
    const body = await request.json();
    const { accountId, ...payload } = body as { accountId: string } & ComposeEmailPayload;
    if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

    const graph = await getGraphServiceForUser(accountId, userId);
    await graph.sendMail(payload);
    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err);
  }
}
