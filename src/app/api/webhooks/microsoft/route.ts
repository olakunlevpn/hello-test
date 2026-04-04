import { NextRequest, NextResponse } from "next/server";
import { webhookProcessingQueue } from "@/lib/queue";

export async function POST(request: NextRequest) {
  // Handle validation handshake
  const validationToken = request.nextUrl.searchParams.get("validationToken");
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  // Process notifications
  try {
    const body = await request.json();
    const notifications = body.value || [];

    for (const notification of notifications) {
      if (notification.clientState !== process.env.WEBHOOK_CLIENT_STATE) {
        continue;
      }

      await webhookProcessingQueue.add("notification", {
        type: "notification",
        resource: notification.resource,
        changeType: notification.changeType,
        subscriptionId: notification.subscriptionId,
        tenantId: notification.tenantId,
      });
    }

    return new NextResponse(null, { status: 202 });
  } catch {
    return new NextResponse(null, { status: 202 });
  }
}
