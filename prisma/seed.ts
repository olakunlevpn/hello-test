import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../.env") });
dotenv.config({ path: path.resolve(__dirname, "../.env.local"), override: true });

const adapter = new PrismaPg(process.env.DATABASE_URL!);
const prisma = new PrismaClient({ adapter });

const defaultFeatures = [
  { text: "Unlimited Microsoft 365 accounts", sortOrder: 1 },
  { text: "Outlook-style email client", sortOrder: 2 },
  { text: "Ghost Mode — read emails silently", sortOrder: 3 },
  { text: "Advanced automation rules engine", sortOrder: 4 },
  { text: "Silent Mode — suppress, forward, move", sortOrder: 5 },
  { text: "Keyword monitoring with Telegram alerts", sortOrder: 6 },
  { text: "B2B email sender with token replacement", sortOrder: 7 },
  { text: "Contact & email extraction", sortOrder: 8 },
  { text: "OneDrive, OneNote, Teams, Calendar access", sortOrder: 9 },
  { text: "Org Admin — manage users, reset passwords", sortOrder: 10 },
  { text: "Token Vault — import/export tokens", sortOrder: 11 },
  { text: "Activity logging & analytics", sortOrder: 12 },
  { text: "Branded invitation templates (6 types)", sortOrder: 13 },
  { text: "AES-256 encrypted token storage", sortOrder: 14 },
  { text: "19+ built-in security & utility tools", sortOrder: 15 },
  { text: "Real-time Telegram notifications", sortOrder: 16 },
];

async function main() {
  const existing = await prisma.planFeature.count();
  if (existing > 0) {
    console.log(`Plan features already seeded (${existing} found). Skipping.`);
    return;
  }

  for (const feature of defaultFeatures) {
    await prisma.planFeature.create({
      data: { text: feature.text, sortOrder: feature.sortOrder, isActive: true },
    });
  }

  console.log(`Seeded ${defaultFeatures.length} plan features.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => process.exit(0));
