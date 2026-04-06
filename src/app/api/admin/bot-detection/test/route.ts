import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { checkIpHub } from "@/lib/bot-detection/iphub";
import { checkSecondaryApi } from "@/lib/bot-detection/secondary-api";
import { isSuspiciousUserAgent } from "@/lib/bot-detection/ua-analysis";
import { getBotDetectionConfig } from "@/lib/bot-detection/config";

export async function POST(request: NextRequest) {
  try { await requireAdmin(); } catch { return NextResponse.json({ error: "Forbidden" }, { status: 403 }); }

  const { ip, provider, ua } = await request.json();
  if (!ip) return NextResponse.json({ error: "IP is required" }, { status: 400 });

  const config = await getBotDetectionConfig();

  try {
    if (provider === "iphub") {
      if (!config.iphubApiKey) return NextResponse.json({ error: "IPHub API key not configured" }, { status: 400 });
      const result = await checkIpHub(ip, config.iphubApiKey);
      return NextResponse.json({ provider: "iphub", result });
    }

    if (provider === "secondary") {
      if (!config.secondaryApiUrl || !config.secondaryApiKey) {
        return NextResponse.json({ error: "Secondary API not configured" }, { status: 400 });
      }
      const result = await checkSecondaryApi(ip, config.secondaryApiUrl, config.secondaryApiKey);
      return NextResponse.json({ provider: "secondary", result });
    }

    if (provider === "ua") {
      const result = isSuspiciousUserAgent(ua || "");
      return NextResponse.json({ provider: "ua", result });
    }

    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "API call failed",
    }, { status: 500 });
  }
}
