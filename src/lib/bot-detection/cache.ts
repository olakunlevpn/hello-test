import { redis } from "../redis";

const IP_PREFIX = "botcheck:";
const CONFIG_KEY = "botdetection:config";

export interface CachedIpResult {
  blocked: boolean;
  reason: string | null;
  provider: string | null;
}

export async function getCachedIpResult(ip: string): Promise<CachedIpResult | null> {
  try {
    const data = await redis.get(`${IP_PREFIX}${ip}`);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setCachedIpResult(ip: string, result: CachedIpResult, ttlSeconds: number): Promise<void> {
  try {
    await redis.set(`${IP_PREFIX}${ip}`, JSON.stringify(result), "EX", ttlSeconds);
  } catch { /* cache failure is non-critical */ }
}

export async function getCachedConfig(): Promise<Record<string, string> | null> {
  try {
    const data = await redis.get(CONFIG_KEY);
    if (!data) return null;
    return JSON.parse(data);
  } catch {
    return null;
  }
}

export async function setCachedConfig(config: Record<string, string>): Promise<void> {
  try {
    await redis.set(CONFIG_KEY, JSON.stringify(config), "EX", 60);
  } catch { /* cache failure is non-critical */ }
}

export async function clearConfigCache(): Promise<void> {
  try {
    await redis.del(CONFIG_KEY);
  } catch { /* non-critical */ }
}
