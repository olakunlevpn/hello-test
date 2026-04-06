import { NextRequest } from "next/server";
import { createHash } from "crypto";
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
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return null;

  // Hash the token and check against the stored session token on the record
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const link = await prisma.sharedLink.findUnique({
    where: { code },
    select: {
      linkedAccountId: true,
      sessionToken: true,
      status: true,
      expiresAt: true,
      linkedAccount: { select: { status: true } },
    },
  });

  if (!link) return null;
  if (!link.sessionToken || link.sessionToken !== tokenHash) return null;
  if (link.status !== "ACTIVE") return null;
  if (link.expiresAt && new Date() > link.expiresAt) return null;
  if (link.linkedAccount.status !== "ACTIVE") return null;

  return { linkedAccountId: link.linkedAccountId, code };
}
