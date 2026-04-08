import { NextRequest, NextResponse } from "next/server";
import { readFileSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { invitationId } = body;

  if (!invitationId) {
    return NextResponse.json({ error: "Invitation ID required" }, { status: 400 });
  }

  const invitation = await prisma.invitation.findFirst({
    where: { id: invitationId, userId },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { cloudflareApiToken: true, cloudflareAccountId: true },
  });

  if (!user?.cloudflareApiToken || !user?.cloudflareAccountId) {
    return NextResponse.json({ error: "Cloudflare not configured. Go to Settings to add your API token." }, { status: 400 });
  }

  const apiToken = decrypt(user.cloudflareApiToken);
  const accountId = user.cloudflareAccountId;

  // Read the HTML template
  const templateDir = join(process.cwd(), "invitation-templates", invitation.template);
  let html: string;
  try {
    html = readFileSync(join(templateDir, "index.html"), "utf-8");
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }

  // Replace placeholders
  const apiBase = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}`
    : process.env.NEXTAUTH_URL || "https://localhost:3000";

  html = html.replace(/\{\{\s*domain\s*\}\}/g, apiBase);
  html = html.replace(/\{\{\s*invitation\s*\}\}/g, invitation.code);

  const projectName = `inv-${invitation.code.slice(0, 12)}`;
  const cfApi = "https://api.cloudflare.com/client/v4";

  // Step 1: Create project (ignore if already exists)
  const createRes = await fetch(`${cfApi}/accounts/${accountId}/pages/projects`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: projectName, production_branch: "main" }),
  });

  if (!createRes.ok) {
    const data = await createRes.json();
    const alreadyExists = data.errors?.some((e: { code: number }) => e.code === 8000009);
    if (!alreadyExists) {
      return NextResponse.json({ error: "Failed to create Cloudflare project" }, { status: 500 });
    }
  }

  // Step 2: Get upload JWT
  const jwtRes = await fetch(`${cfApi}/accounts/${accountId}/pages/projects/${projectName}/upload-token`, {
    headers: { Authorization: `Bearer ${apiToken}` },
  });

  if (!jwtRes.ok) {
    return NextResponse.json({ error: "Failed to get upload token" }, { status: 500 });
  }

  const jwtData = await jwtRes.json();
  const uploadJwt = jwtData.result?.jwt;

  if (!uploadJwt) {
    return NextResponse.json({ error: "No upload token received" }, { status: 500 });
  }

  // Compute content hash (sha256, first 32 hex chars)
  const contentBuffer = Buffer.from(html, "utf-8");
  const contentHash = createHash("sha256").update(contentBuffer).digest("hex").slice(0, 32);
  const contentBase64 = contentBuffer.toString("base64");

  // Step 3: Upload file content
  const uploadRes = await fetch(`${cfApi}/pages/assets/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${uploadJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify([
      {
        key: contentHash,
        value: contentBase64,
        metadata: { contentType: "text/html" },
        base64: true,
      },
    ]),
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json();
    return NextResponse.json({ error: errData.errors?.[0]?.message || "File upload failed" }, { status: 500 });
  }

  // Step 4: Register hashes
  await fetch(`${cfApi}/pages/assets/upsert-hashes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${uploadJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: [contentHash] }),
  });

  // Step 5: Create deployment with manifest
  const formData = new FormData();
  formData.append("manifest", JSON.stringify({ "/index.html": contentHash }));

  const deployRes = await fetch(`${cfApi}/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body: formData,
  });

  if (!deployRes.ok) {
    const errData = await deployRes.json();
    return NextResponse.json({ error: errData.errors?.[0]?.message || "Deployment failed" }, { status: 500 });
  }

  const deployData = await deployRes.json();
  const deployUrl = `https://${projectName}.pages.dev`;

  // Save the deployed URL to the invitation
  await prisma.invitation.update({
    where: { id: invitation.id },
    data: { deployedUrl: deployUrl },
  });

  return NextResponse.json({
    success: true,
    url: deployUrl,
    projectName,
  });
}
