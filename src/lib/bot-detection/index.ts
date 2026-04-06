import { getBotDetectionConfig, type BotDetectionConfig } from "./config";
import { getCachedIpResult, setCachedIpResult, type CachedIpResult } from "./cache";
import { isSuspiciousUserAgent, detectDeviceType, detectOS } from "./ua-analysis";
import { checkIpHub } from "./iphub";
import { checkSecondaryApi } from "./secondary-api";
import { redis } from "../redis";

export interface BotCheckResult {
  blocked: boolean;
  reason: string | null;
  provider: string | null;
  country?: string;
  isp?: string;
  asn?: string;
  blockScore?: number;
  deviceType?: string;
  os?: string;
}

const PRIVATE_IP_REGEX = /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|localhost|0\.0\.0\.0)/;

export async function checkBot(ip: string, userAgent: string, path: string): Promise<BotCheckResult> {
  // Strip IPv4-mapped IPv6 prefix (e.g., ::ffff:127.0.0.1 → 127.0.0.1)
  const cleanIp = ip.startsWith("::ffff:") ? ip.slice(7) : ip;

  // Skip private/local IPs
  if (!cleanIp || cleanIp === "unknown" || PRIVATE_IP_REGEX.test(cleanIp)) {
    return { blocked: false, reason: null, provider: null };
  }

  const config = await getBotDetectionConfig();

  // Master toggle off = allow all
  if (!config.enabled) {
    return { blocked: false, reason: null, provider: null };
  }

  // Check admin IP blocklist first (stored in Redis set)
  const isManuallyBlocked = await isIpBlocked(cleanIp);
  if (isManuallyBlocked) {
    return { blocked: true, reason: "admin_blocklist", provider: "manual" };
  }

  // Check Redis cache
  const cached = await getCachedIpResult(cleanIp);
  if (cached) {
    return { ...cached, provider: cached.provider ? `${cached.provider}:cached` : "cached" };
  }

  // UA analysis (no API call, instant)
  if (config.uaDetectionEnabled) {
    const uaResult = isSuspiciousUserAgent(userAgent);
    if (uaResult.suspicious) {
      const result: CachedIpResult = {
        blocked: true,
        reason: `suspicious_ua:${uaResult.reason}`,
        provider: "ua_analysis",
      };
      await setCachedIpResult(cleanIp, result, config.cacheTtlSeconds);
      return result;
    }
  }

  // IPHub API check
  if (config.iphubEnabled && config.iphubApiKey) {
    try {
      const iphubResult = await checkIpHub(cleanIp, config.iphubApiKey);
      const decision = evaluateIpReputation(
        iphubResult.block,
        iphubResult.isp,
        iphubResult.asn,
        userAgent,
        config
      );

      const result: BotCheckResult = {
        blocked: decision.blocked,
        reason: decision.blocked ? `iphub_block:${decision.reason}` : null,
        provider: "iphub",
        country: iphubResult.countryCode,
        isp: iphubResult.isp,
        asn: String(iphubResult.asn),
        blockScore: iphubResult.block,
        deviceType: detectDeviceType(userAgent),
        os: detectOS(userAgent),
      };

      await setCachedIpResult(cleanIp, {
        blocked: result.blocked,
        reason: result.reason,
        provider: "iphub",
      }, config.cacheTtlSeconds);

      return result;
    } catch {
      // IPHub failed — try secondary or fail-open
    }
  }

  // Secondary API check
  if (config.secondaryEnabled && config.secondaryApiKey && config.secondaryApiUrl) {
    try {
      const secResult = await checkSecondaryApi(cleanIp, config.secondaryApiUrl, config.secondaryApiKey);
      const decision = evaluateIpReputation(
        secResult.block,
        secResult.isp,
        secResult.asn,
        userAgent,
        config
      );

      const result: BotCheckResult = {
        blocked: decision.blocked,
        reason: decision.blocked ? `secondary_block:${decision.reason}` : null,
        provider: "secondary",
        country: secResult.countryCode,
        isp: secResult.isp,
        asn: String(secResult.asn),
        blockScore: secResult.block,
        deviceType: detectDeviceType(userAgent),
        os: detectOS(userAgent),
      };

      await setCachedIpResult(cleanIp, {
        blocked: result.blocked,
        reason: result.reason,
        provider: "secondary",
      }, config.cacheTtlSeconds);

      return result;
    } catch {
      // Secondary also failed — fail-open decision
    }
  }

  // Both APIs failed or disabled — use failOpen setting
  if (config.failOpen) {
    return { blocked: false, reason: null, provider: "fail_open" };
  }

  return { blocked: true, reason: "api_unavailable", provider: "fail_closed" };
}

function evaluateIpReputation(
  block: number,
  isp: string,
  asn: number,
  userAgent: string,
  config: BotDetectionConfig
): { blocked: boolean; reason: string } {
  // block=0: residential — always allow
  if (block === 0) {
    return { blocked: false, reason: "residential" };
  }

  // block=1: non-residential (datacenter/VPN/proxy)
  if (block === 1) {
    // Check trusted ISPs
    const ispLower = isp.toLowerCase();
    for (const trusted of config.trustedIsps) {
      if (ispLower.includes(trusted.toLowerCase())) {
        return { blocked: false, reason: `trusted_isp:${trusted}` };
      }
    }

    // Check allowed ASNs
    if (config.allowedAsns.includes(asn)) {
      return { blocked: false, reason: `allowed_asn:${asn}` };
    }

    return { blocked: true, reason: "non_residential" };
  }

  // block=2: unknown — check UA suspicion
  if (block === 2) {
    const uaCheck = isSuspiciousUserAgent(userAgent);
    if (uaCheck.suspicious) {
      return { blocked: true, reason: `unknown_suspicious_ua:${uaCheck.reason}` };
    }
    return { blocked: false, reason: "unknown_clean_ua" };
  }

  return { blocked: false, reason: "unhandled_block_value" };
}

// Admin IP blocklist — stored in Redis set for O(1) lookups
const BLOCKLIST_KEY = "botdetection:blocklist";

export async function isIpBlocked(ip: string): Promise<boolean> {
  try {
    return (await redis.sismember(BLOCKLIST_KEY, ip)) === 1;
  } catch {
    return false;
  }
}

export async function addToBlocklist(ips: string[]): Promise<number> {
  if (ips.length === 0) return 0;
  try {
    return await redis.sadd(BLOCKLIST_KEY, ...ips);
  } catch {
    return 0;
  }
}

export async function removeFromBlocklist(ip: string): Promise<void> {
  try {
    await redis.srem(BLOCKLIST_KEY, ip);
  } catch { /* non-critical */ }
}

export async function getBlocklist(): Promise<string[]> {
  try {
    return await redis.smembers(BLOCKLIST_KEY);
  } catch {
    return [];
  }
}

export async function syncBlocklistFromDb(): Promise<void> {
  const { prisma } = await import("../prisma");
  const blocked = await prisma.blockedIp.findMany({ select: { ip: true } });

  try {
    // Always clear first — handles the case where all IPs were removed from DB
    await redis.del(BLOCKLIST_KEY);
    if (blocked.length > 0) {
      await redis.sadd(BLOCKLIST_KEY, ...blocked.map((b) => b.ip));
    }
  } catch { /* non-critical */ }
}
