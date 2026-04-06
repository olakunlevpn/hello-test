import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { clearConfigCache } from "@/lib/bot-detection/cache";

export async function GET() {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: "botDetection." } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    // Mask API keys — only show last 4 chars
    if (s.key.endsWith(".apiKey") && s.value.length > 4) {
      map[s.key] = "****" + s.value.slice(-4);
    } else {
      map[s.key] = s.value;
    }
  }

  return NextResponse.json({ settings: map });
}

export async function PUT(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { settings } = body as { settings: Record<string, string> };

  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  // Only allow botDetection.* keys
  const entries = Object.entries(settings).filter(([key]) => key.startsWith("botDetection."));

  for (const [key, value] of entries) {
    // Skip masked API keys — don't overwrite real key with the mask
    if (key.endsWith(".apiKey") && String(value).startsWith("****")) {
      continue;
    }
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  await clearConfigCache();

  return NextResponse.json({ success: true });
}
