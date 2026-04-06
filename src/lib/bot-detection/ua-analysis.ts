import { isbot } from "isbot";

// Headless browsers — isbot doesn't detect these (focuses on "good bots")
const HEADLESS_PATTERNS = [
  "headlesschrome", "phantomjs", "puppeteer", "playwright",
  "selenium", "jsdom", "nightmare", "casperjs",
];

// HTTP tools and libraries
const TOOL_PATTERNS = [
  "python-requests", "python-urllib", "curl/", "wget/", "go-http-client",
  "apache-httpclient", "java/", "libwww-perl", "scrapy", "httpclient",
  "node-fetch", "axios/", "postman", "insomnia", "httpie",
];

export function isSuspiciousUserAgent(ua: string): { suspicious: boolean; reason: string | null } {
  if (!ua || ua.length < 15) {
    return { suspicious: true, reason: "empty_or_short_ua" };
  }

  // isbot: catches 500+ known crawlers/spiders (community-maintained)
  if (isbot(ua)) {
    return { suspicious: true, reason: "known_bot" };
  }

  const lower = ua.toLowerCase();

  // Headless browsers (not caught by isbot)
  for (const pattern of HEADLESS_PATTERNS) {
    if (lower.includes(pattern)) {
      return { suspicious: true, reason: `headless_browser:${pattern}` };
    }
  }

  // HTTP tools
  for (const pattern of TOOL_PATTERNS) {
    if (lower.includes(pattern)) {
      return { suspicious: true, reason: `http_tool:${pattern}` };
    }
  }

  // No standard browser identifier at all
  const hasBrowserId = lower.includes("mozilla/") || lower.includes("chrome/") ||
    lower.includes("safari/") || lower.includes("firefox/") || lower.includes("edge/") ||
    lower.includes("opera/");
  if (!hasBrowserId) {
    return { suspicious: true, reason: "no_browser_identifier" };
  }

  return { suspicious: false, reason: null };
}

export function detectDeviceType(ua: string): string {
  if (!ua) return "unknown";
  if (isbot(ua)) return "bot";
  if (/mobile|android|iphone|ipod|windows phone|blackberry/i.test(ua)) return "mobile";
  if (/ipad|tablet|kindle|silk/i.test(ua)) return "tablet";
  return "desktop";
}

export function detectOS(ua: string): string {
  if (!ua) return "unknown";
  if (/windows nt 10/i.test(ua)) return "Windows 10+";
  if (/windows nt/i.test(ua)) return "Windows";
  if (/mac os x/i.test(ua)) return "macOS";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/linux/i.test(ua)) return "Linux";
  if (/cros/i.test(ua)) return "ChromeOS";
  return "unknown";
}
