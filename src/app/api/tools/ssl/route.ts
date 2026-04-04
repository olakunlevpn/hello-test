import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { execSync } from "child_process";

export async function GET(request: NextRequest) {
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const domain = request.nextUrl.searchParams.get("domain")?.replace(/[^a-zA-Z0-9.-]/g, "");
  if (!domain) return NextResponse.json({ error: "domain is required" }, { status: 400 });

  try {
    const output = execSync(
      `echo | openssl s_client -servername ${domain} -connect ${domain}:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates -serial -fingerprint -sha256 2>/dev/null`,
      { timeout: 10000, encoding: "utf-8" }
    );

    const lines = output.split("\n");
    const find = (prefix: string) => {
      const line = lines.find((l) => l.startsWith(prefix));
      return line?.substring(prefix.length).trim() || "Unknown";
    };

    const subjectLine = find("subject=");
    const issuerLine = find("issuer=");
    const notBefore = find("notBefore=");
    const notAfter = find("notAfter=");
    const serial = find("serial=");
    const fingerprint = find("sha256 Fingerprint=") !== "Unknown" ? find("sha256 Fingerprint=") : find("SHA256 Fingerprint=");

    // Extract CN from subject
    const subjectCN = subjectLine.match(/CN=([^,/]+)/)?.[1] || subjectLine;
    const issuerO = issuerLine.match(/O=([^,/]+)/)?.[1] || issuerLine.match(/CN=([^,/]+)/)?.[1] || issuerLine;

    const now = new Date();
    const validFromDate = new Date(notBefore);
    const validToDate = new Date(notAfter);
    const valid = !isNaN(validFromDate.getTime()) && !isNaN(validToDate.getTime()) && now >= validFromDate && now <= validToDate;

    return NextResponse.json({
      domain,
      valid,
      subject: subjectCN,
      issuer: issuerO,
      validFrom: notBefore,
      validTo: notAfter,
      serialNumber: serial,
      fingerprint,
    });
  } catch {
    return NextResponse.json({ error: "SSL lookup failed. Check the domain and try again." }, { status: 500 });
  }
}
