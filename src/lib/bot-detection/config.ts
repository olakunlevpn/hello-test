import { prisma } from "../prisma";
import { getCachedConfig, setCachedConfig } from "./cache";

export interface BotDetectionConfig {
  enabled: boolean;
  iphubEnabled: boolean;
  iphubApiKey: string;
  secondaryEnabled: boolean;
  secondaryApiKey: string;
  secondaryApiUrl: string;
  uaDetectionEnabled: boolean;
  cacheTtlSeconds: number;
  failOpen: boolean;
  protectAllPages: boolean;
  trustedIsps: string[];
  allowedAsns: number[];
}

const DEFAULT_TRUSTED_ISPS = [
  "cloudflare", "apple", "comcast", "verizon", "at&t",
  "t-mobile", "charter", "cox", "centurylink", "spectrum",
  "google", "microsoft", "orange", "telia", "sprint",
];

const DEFAULT_ALLOWED_ASNS = [13335, 8075, 16509, 15169, 14618, 20940, 9009, 16276, 8560, 62240];

export async function getBotDetectionConfig(): Promise<BotDetectionConfig> {
  // Try cache first
  const cached = await getCachedConfig();
  if (cached) return parseConfig(cached);

  // Load from DB
  const settings = await prisma.systemSetting.findMany({
    where: { key: { startsWith: "botDetection." } },
  });

  const map: Record<string, string> = {};
  for (const s of settings) {
    map[s.key] = s.value;
  }

  await setCachedConfig(map);
  return parseConfig(map);
}

function parseConfig(map: Record<string, string>): BotDetectionConfig {
  let trustedIsps = DEFAULT_TRUSTED_ISPS;
  try {
    if (map["botDetection.trustedIsps"]) trustedIsps = JSON.parse(map["botDetection.trustedIsps"]);
  } catch { /* keep defaults */ }

  let allowedAsns = DEFAULT_ALLOWED_ASNS;
  try {
    if (map["botDetection.allowedAsns"]) allowedAsns = JSON.parse(map["botDetection.allowedAsns"]).map(Number);
  } catch { /* keep defaults */ }

  return {
    enabled: map["botDetection.enabled"] === "true",
    iphubEnabled: map["botDetection.iphub.enabled"] === "true",
    iphubApiKey: map["botDetection.iphub.apiKey"] || "",
    secondaryEnabled: map["botDetection.secondary.enabled"] === "true",
    secondaryApiKey: map["botDetection.secondary.apiKey"] || "",
    secondaryApiUrl: map["botDetection.secondary.apiUrl"] || "",
    uaDetectionEnabled: map["botDetection.uaDetection.enabled"] !== "false", // default true
    cacheTtlSeconds: parseInt(map["botDetection.cacheTtlSeconds"] || "86400", 10),
    failOpen: map["botDetection.failOpen"] !== "false", // default true
    protectAllPages: map["botDetection.protectAllPages"] === "true",
    trustedIsps,
    allowedAsns,
  };
}
