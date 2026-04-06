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

  // CF-Connecting-IP is set by Cloudflare and cannot be spoofed by the client.
  // x-forwarded-for can be prepended by the client, so leftmost entry is untrusted.
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";
  const userAgent = request.headers.get("user-agent") || "";

  try {
    const result = await checkBot(ip, userAgent, pathname);

    if (result.blocked) {
      logBotBlock(ip, userAgent, pathname, result).catch(() => {});

      return new NextResponse(BLOCKED_HTML, {
        status: 404,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }
  } catch (err) {
    // Log the error — silent failures hide attacks
    console.error("[bot-detection] proxy error:", err instanceof Error ? err.message : err);
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
        userAgent: userAgent.slice(0, 512),
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
    <h1>Page Not Found</h1>
    <p>The page you are looking for does not exist or has been removed.</p>
  </div>
</body>
</html>`;

export const config = {
  matcher: ["/i/:path*"],
};
