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
  for (const s of settings) map[s.key] = s.value;

  return NextResponse.json({ settings: map });
}

export async function PUT(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const body = await request.json();
  const { settings } = body as { settings: Record<string, string> };

  if (!settings || typeof settings !== "object") {
    return NextResponse.json({ error: "Invalid settings" }, { status: 400 });
  }

  // Only allow botDetection.* keys
  const entries = Object.entries(settings).filter(([key]) => key.startsWith("botDetection."));

  for (const [key, value] of entries) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value) },
      create: { key, value: String(value) },
    });
  }

  await clearConfigCache();

  return NextResponse.json({ success: true });
}
