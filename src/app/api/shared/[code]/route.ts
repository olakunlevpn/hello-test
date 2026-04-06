import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword } from "@/lib/password";
import { createHash, randomBytes } from "crypto";

// Rate limit: track attempts per code per IP
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

    // Uniform error for all failures — prevents enumeration
    if (!link || link.status === "SUSPENDED" ||
        (link.expiresAt && new Date() > link.expiresAt) ||
        link.linkedAccount.status !== "ACTIVE") {
      return NextResponse.json({ error: "Invalid link or password" }, { status: 401 });
    }

    // Verify password — support both bcrypt and legacy SHA-256 hashes
    let valid = false;
    const isBcrypt = link.passwordHash.startsWith("$2");
    if (isBcrypt) {
      valid = await verifyPassword(password, link.passwordHash);
    } else {
      // Legacy SHA-256 hash
      valid = createHash("sha256").update(password).digest("hex") === link.passwordHash;
      // Auto-upgrade to bcrypt
      if (valid) {
        const bcryptHash = await hashPassword(password);
        await prisma.sharedLink.update({ where: { id: link.id }, data: { passwordHash: bcryptHash } });
      }
    }
    if (!valid) {
      return NextResponse.json({ error: "Invalid link or password" }, { status: 401 });
    }

    // Generate session token and store hash on the record
    const sessionToken = randomBytes(32).toString("hex");
    const sessionHash = createHash("sha256").update(sessionToken).digest("hex");

    await prisma.sharedLink.update({
      where: { id: link.id },
      data: {
        viewCount: { increment: 1 },
        lastViewedAt: new Date(),
        sessionToken: sessionHash,
      },
    });

    return NextResponse.json({
      success: true,
      email: link.linkedAccount.email,
      displayName: link.linkedAccount.displayName,
      sessionToken,
    });
  } catch {
    return NextResponse.json({ error: "Authentication failed" }, { status: 500 });
  }
}
