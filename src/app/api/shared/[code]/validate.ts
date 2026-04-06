import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { prisma } from "@/lib/prisma";

interface SharedSession {
  linkedAccountId: string;
  code: string;
}

export async function validateSharedSession(
  request: NextRequest,
  code: string
): Promise<SharedSession | null> {
  const authHeader = request.headers.get("authorization");
  const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!rawToken) return null;

  try {
    // Decode base64 token
    const decoded = Buffer.from(rawToken, "base64").toString("utf-8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [tokenCode, linkedAccountId, expiresAtStr, signature] = parts;

    // Verify code matches
    if (tokenCode !== code) return null;

    // Verify not expired
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || Date.now() > expiresAt) return null;

    // Verify HMAC signature
    const secret = process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || "fallback";
    const payload = `${tokenCode}:${linkedAccountId}:${expiresAtStr}`;
    const expectedSignature = createHmac("sha256", secret).update(payload).digest("hex");
    if (signature !== expectedSignature) return null;

    // Verify the link is still active in DB
    const link = await prisma.sharedLink.findUnique({
      where: { code },
      select: {
        status: true,
        expiresAt: true,
        linkedAccountId: true,
        linkedAccount: { select: { status: true } },
      },
    });

    if (!link) return null;
    if (link.status !== "ACTIVE") return null;
    if (link.expiresAt && new Date() > link.expiresAt) return null;
    if (link.linkedAccount.status !== "ACTIVE") return null;
    if (link.linkedAccountId !== linkedAccountId) return null;

    return { linkedAccountId, code };
  } catch {
    return null;
  }
}
