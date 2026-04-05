import { NextResponse } from "next/server";

// This endpoint is used for HTTP-based domain verification.
// When a custom domain points to our server (directly or via Cloudflare),
// requests to this endpoint will reach our Next.js app. The verification
// process checks for the unique token in the response.
const VERIFY_TOKEN = process.env.DOMAIN_VERIFY_TOKEN || "forg365-domain-active";

export async function GET() {
  return NextResponse.json({ token: VERIFY_TOKEN });
}
