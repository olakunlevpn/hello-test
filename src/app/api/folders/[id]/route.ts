import { NextRequest, NextResponse } from "next/server";
import { requireActiveSubscription, getGraphServiceForUser } from "@/lib/auth";
import { safeError } from "@/lib/api-error";

export async function PATCH(
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

  const { id: folderId } = await params;
  const { accountId, displayName } = await request.json();

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  if (!displayName?.trim()) return NextResponse.json({ error: "displayName is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    const folder = await graph.renameFolder(folderId, displayName.trim());
    return NextResponse.json(folder);
  } catch (err) {
    return safeError(err);
  }
}

export async function DELETE(
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

  const { id: folderId } = await params;
  const accountId = request.nextUrl.searchParams.get("accountId");

  if (!accountId) return NextResponse.json({ error: "accountId is required" }, { status: 400 });

  try {
    const graph = await getGraphServiceForUser(accountId, userId);
    await graph.deleteFolder(folderId);
    return NextResponse.json({ success: true });
  } catch (err) {
    return safeError(err);
  }
}
