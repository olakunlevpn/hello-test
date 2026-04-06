import { NextRequest } from "next/server";
import { createHash } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

interface SharedSession {
  linkedAccountId: string;
  code: string;
}

export async function validateSharedSession(
  request: NextRequest,
  code: string
): Promise<SharedSession | null> {
  // Get session token from Authorization header
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  // Verify token against the cookie set during password auth
  const cookieStore = await cookies();
  const storedHash = cookieStore.get(`shared_${code}`)?.value;
  if (!storedHash) return null;

  const tokenHash = createHash("sha256").update(token).digest("hex");
  if (tokenHash !== storedHash) return null;

  // Look up the shared link and verify it's still valid
  const link = await prisma.sharedLink.findUnique({
    where: { code },
    select: {
      linkedAccountId: true,
      status: true,
      expiresAt: true,
      linkedAccount: { select: { status: true } },
    },
  });

  if (!link) return null;
  if (link.status !== "ACTIVE") return null;
  if (link.expiresAt && new Date() > link.expiresAt) return null;
  if (link.linkedAccount.status !== "ACTIVE") return null;

  return { linkedAccountId: link.linkedAccountId, code };
}
