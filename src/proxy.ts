import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { checkBot } from "./lib/bot-detection";

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Only check invitation pages and public landing
  const isProtectedPath = pathname.startsWith("/i/");
  if (!isProtectedPath) {
    return NextResponse.next();
  }

  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  try {
    const result = await checkBot(ip, userAgent, pathname);

    if (result.blocked) {
      // Log asynchronously — don't block the response
      logBotBlock(ip, userAgent, pathname, result).catch(() => {});

      // Return a generic page — don't reveal bot detection
      return new NextResponse(BLOCKED_HTML, {
        status: 403,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } catch {
    // Bot detection error — fail open, don't block real users
  }

  return NextResponse.next();
}

async function logBotBlock(
  ip: string,
  userAgent: string,
  path: string,
  result: Awaited<ReturnType<typeof checkBot>>
): Promise<void> {
  try {
    const { prisma } = await import("./lib/prisma");
    await prisma.botLog.create({
      data: {
        ip,
        userAgent,
        path,
        reason: result.reason || "unknown",
        provider: result.provider,
        country: result.country,
        isp: result.isp,
        asn: result.asn,
        blockScore: result.blockScore,
        action: "blocked",
      },
    });
  } catch { /* logging failure is non-critical */ }
}

const BLOCKED_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Page Not Available</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0a0a0a;color:#e5e5e5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
    .c{text-align:center;padding:2rem;max-width:480px}
    h1{font-size:1.5rem;font-weight:700;color:#fff;margin-bottom:.75rem}
    p{font-size:.9rem;color:#888;line-height:1.6}
  </style>
</head>
<body>
  <div class="c">
    <h1>Page Not Available</h1>
    <p>This page could not be loaded. Please try again from a different network or contact support if the issue persists.</p>
  </div>
</body>
</html>`;

export const config = {
  matcher: ["/i/:path*"],
};
