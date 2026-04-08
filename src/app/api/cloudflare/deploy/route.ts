import { NextRequest, NextResponse } from "next/server";
import { readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, statSync } from "fs";
import { join, relative, extname } from "path";
import { execSync } from "child_process";
import { tmpdir } from "os";
import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";
import { decrypt } from "@/lib/encryption";

const TEXT_EXTENSIONS = [".html", ".css", ".js", ".json", ".svg", ".xml", ".txt"];

function copyDir(src: string, dest: string) {
  mkdirSync(dest, { recursive: true });
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.includes(ext)) {
        // Text files get variable replacement
        copyFileSync(srcPath, destPath);
      } else {
        // Binary files copied as-is
        copyFileSync(srcPath, destPath);
      }
    }
  }
}

function replaceInDir(dir: string, replacements: Record<string, string>) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      replaceInDir(fullPath, replacements);
    } else if (entry.isFile()) {
      const ext = extname(entry.name).toLowerCase();
      if (TEXT_EXTENSIONS.includes(ext)) {
        let text = readFileSync(fullPath, "utf-8");
        for (const [pattern, value] of Object.entries(replacements)) {
          text = text.replace(new RegExp(`\\{\\{\\s*${pattern}\\s*\\}\\}`, "g"), value);
        }
        writeFileSync(fullPath, text, "utf-8");
      }
    }
  }
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

  // Verify template exists
  const templateDir = join(process.cwd(), "invitation-templates", invitation.template);
  try {
    const stat = statSync(templateDir);
    if (!stat.isDirectory()) throw new Error();
  } catch {
    return NextResponse.json({ error: "Template not found" }, { status: 400 });
  }

  const backendOrigin = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN
    ? `https://${process.env.NEXT_PUBLIC_PLATFORM_DOMAIN}`
    : process.env.NEXTAUTH_URL || "https://localhost:3000";

  const projectName = `inv-${invitation.code.slice(0, 12)}`;

  // Create temp deploy folder
  const tmpDir = join(tmpdir(), `cf-deploy-${randomBytes(8).toString("hex")}`);
  mkdirSync(tmpDir, { recursive: true });

  try {
    // Step 1: Copy template files to temp folder
    copyDir(templateDir, tmpDir);

    // Step 2: Replace template variables in text files
    replaceInDir(tmpDir, {
      domain: "",
      invitation: invitation.code,
      senderName: invitation.senderName,
      documentTitle: invitation.documentTitle,
      docType: invitation.docType,
      note: invitation.notes || "",
    });

    // Step 3: Write _worker.js proxy
    const backendHost = new URL(backendOrigin).host;
    const workerScript = `export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith("/api/")) {
      const target = "${backendOrigin}" + url.pathname + url.search;
      const headers = new Headers(request.headers);
      headers.set("Host", "${backendHost}");
      const clientIP = request.headers.get("CF-Connecting-IP");
      if (clientIP) {
        headers.set("X-Forwarded-For", clientIP);
        headers.set("X-Real-IP", clientIP);
      }
      return fetch(new Request(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      }));
    }
    return env.ASSETS.fetch(request);
  }
};`;
    writeFileSync(join(tmpDir, "_worker.js"), workerScript, "utf-8");

    // Step 4: Create Cloudflare Pages project (ignore if exists)
    const cfApi = "https://api.cloudflare.com/client/v4";
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

    // Step 5: Deploy with wrangler
    const wranglerOutput = execSync(
      `npx wrangler pages deploy "${tmpDir}" --project-name="${projectName}" --branch=main --commit-dirty=true`,
      {
        env: {
          ...process.env,
          CLOUDFLARE_API_TOKEN: apiToken,
          CLOUDFLARE_ACCOUNT_ID: accountId,
        },
        timeout: 120000,
        encoding: "utf-8",
      }
    );

    // Check if deployment succeeded
    if (!wranglerOutput.includes("Deployment complete") && !wranglerOutput.includes("Success")) {
      return NextResponse.json({ error: "Deployment failed" }, { status: 500 });
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
  } catch (err: unknown) {
    let message = "Deployment failed";
    if (err && typeof err === "object") {
      const e = err as { stderr?: string; stdout?: string; message?: string };
      if (e.stderr) {
        const lines = e.stderr.split("\n").filter((l: string) => l.trim() && !l.includes("wrangler") && !l.includes("WARNING"));
        message = lines[0] || e.message || message;
      } else if (e.message) {
        message = e.message;
      }
    }
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    // Cleanup temp folder
    try {
      execSync(`rm -rf "${tmpDir}"`);
    } catch {
      // non-critical
    }
  }
}
