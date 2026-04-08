import { NextRequest, NextResponse } from "next/server";
import { readFileSync, readdirSync } from "fs";
import { join, relative, extname } from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".avif": "image/avif",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".otf": "font/otf",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".pdf": "application/pdf",
  ".xml": "application/xml",
  ".txt": "text/plain",
};

function getMimeType(filePath: string): string {
  return MIME_TYPES[extname(filePath).toLowerCase()] || "application/octet-stream";
}

function scanDir(dir: string): string[] {
  const files: string[] = [];
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...scanDir(fullPath));
    } else if (entry.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

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

  // Scan all files in the template folder
  const templateDir = join(process.cwd(), "invitation-templates", invitation.template);
  let filePaths: string[];
  try {
    filePaths = scanDir(templateDir);
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }

  if (filePaths.length === 0) {
    return NextResponse.json({ error: "Template folder is empty" }, { status: 400 });
  }

  // Replace placeholders in text files
  const apiBase = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}`
    : process.env.NEXTAUTH_URL || "https://localhost:3000";

  const textExtensions = [".html", ".css", ".js", ".json", ".svg", ".xml", ".txt"];

  // Build upload payload and manifest
  const uploadPayload: { key: string; value: string; metadata: { contentType: string }; base64: true }[] = [];
  const manifest: Record<string, string> = {};

  for (const filePath of filePaths) {
    const relPath = "/" + relative(templateDir, filePath);
    const mime = getMimeType(filePath);
    const ext = extname(filePath).toLowerCase();

    let contentBuffer: Buffer;

    if (textExtensions.includes(ext)) {
      let text = readFileSync(filePath, "utf-8");
      text = text.replace(/\{\{\s*domain\s*\}\}/g, apiBase);
      text = text.replace(/\{\{\s*invitation\s*\}\}/g, invitation.code);
      contentBuffer = Buffer.from(text, "utf-8");
    } else {
      contentBuffer = readFileSync(filePath);
    }

    const hash = createHash("sha256").update(contentBuffer).digest("hex").slice(0, 32);
    const base64Content = contentBuffer.toString("base64");

    uploadPayload.push({
      key: hash,
      value: base64Content,
      metadata: { contentType: mime },
      base64: true,
    });

    manifest[relPath] = hash;
  }

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

  // Step 3: Upload all files
  const uploadRes = await fetch(`${cfApi}/pages/assets/upload`, {
    method: "POST",
    headers: { Authorization: `Bearer ${uploadJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify(uploadPayload),
  });

  if (!uploadRes.ok) {
    const errData = await uploadRes.json();
    return NextResponse.json({ error: errData.errors?.[0]?.message || "File upload failed" }, { status: 500 });
  }

  // Step 4: Register hashes
  const allHashes = Object.values(manifest);
  await fetch(`${cfApi}/pages/assets/upsert-hashes`, {
    method: "POST",
    headers: { Authorization: `Bearer ${uploadJwt}`, "Content-Type": "application/json" },
    body: JSON.stringify({ hashes: allHashes }),
  });

  // Step 5: Create deployment with manifest
  const formData = new FormData();
  formData.append("manifest", JSON.stringify(manifest));

  const deployRes = await fetch(`${cfApi}/accounts/${accountId}/pages/projects/${projectName}/deployments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiToken}` },
    body: formData,
  });

  if (!deployRes.ok) {
    const errData = await deployRes.json();
    return NextResponse.json({ error: errData.errors?.[0]?.message || "Deployment failed" }, { status: 500 });
  }

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
