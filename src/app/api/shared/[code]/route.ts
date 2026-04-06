import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createHash, createHmac, randomBytes } from "crypto";

const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60_000;

function isRateLimited(code: string, ip: string): boolean {
  const key = `${code}:${ip}`;
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || now > entry.resetAt) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > MAX_ATTEMPTS;
}

// HMAC-signed session token — no DB storage needed
function createSessionToken(code: string, linkedAccountId: string): string {
  const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback";
  const expiresAt = Date.now() + 2 * 60 * 60 * 1000; // 2 hours
  const payload = `${code}:${linkedAccountId}:${expiresAt}`;
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  // Return base64-encoded payload + signature
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;
  const ip = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-real-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";

  if (isRateLimited(code, ip)) {
    return NextResponse.json({ error: "Too many attempts. Try again later." }, { status: 429 });
  }

  let body;
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { password } = body;
  if (!password) {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  try {
    const link = await prisma.sharedLink.findUnique({
      where: { code },
      include: {
        linkedAccount: { select: { id: true, email: true, displayName: true, status: true } },
      },
    });

    // Link doesn't exist (deleted) or expired
    if (!link || (link.expiresAt && new Date() > link.expiresAt)) {
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });
    }

    // Suspended or account inactive — don't reveal which
    if (link.status === "SUSPENDED" || link.linkedAccount.status !== "ACTIVE") {
      return NextResponse.json({ error: "link_unavailable" }, { status: 410 });
    }

    // Verify password — support both bcrypt and legacy SHA-256
    let valid = false;
    const isBcrypt = link.passwordHash.startsWith("$2");
    if (isBcrypt) {
      valid = await verifyPassword(password, link.passwordHash);
    } else {
      valid = createHash("sha256").update(password).digest("hex") === link.passwordHash;
      if (valid) {
        const bcryptHash = await hashPassword(password);
        await prisma.sharedLink.update({ where: { id: link.id }, data: { passwordHash: bcryptHash } });
      }
    }

    if (!valid) {
      return NextResponse.json({ error: "Invalid link or password" }, { status: 401 });
    }

    // Update view stats
    await prisma.sharedLink.update({
      where: { id: link.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    // Create stateless HMAC session token — no DB column needed
    const sessionToken = createSessionToken(code, link.linkedAccount.id);

    return NextResponse.json({
      success: true,
      email: link.linkedAccount.email,
      displayName: link.linkedAccount.displayName,
      ghostMode: link.ghostMode,
      sessionToken,
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : "Authentication failed",
    }, { status: 500 });
  }
}
