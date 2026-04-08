import { NextResponse } from "next/server";
import { readdirSync } from "fs";
import { join } from "path";

export async function GET() {
  const templatesDir = join(process.cwd(), "invitation-templates");

  try {
    const entries = readdirSync(templatesDir, { withFileTypes: true });
    const templates = entries
      .filter((e) => e.isDirectory())
      .map((e) => ({
        value: e.name,
        label: e.name
          .split("_")
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(" "),
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return NextResponse.json({ templates });
  } catch {
    return NextResponse.json({ templates: [] });
  }
}
