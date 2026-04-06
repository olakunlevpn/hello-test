export interface SecondaryApiResult {
  ip: string;
  block: number;
  asn: number;
  isp: string;
  countryCode: string;
  country: string;
}

const BLOCKED_HOSTS = [
  "169.254.", "127.", "0.", "10.", "172.16.", "172.17.", "172.18.", "172.19.",
  "172.20.", "172.21.", "172.22.", "172.23.", "172.24.", "172.25.", "172.26.",
  "172.27.", "172.28.", "172.29.", "172.30.", "172.31.", "192.168.", "localhost",
  "metadata.google", "metadata.internal", "[::1]", "[fd",
];

function isInternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:") return true; // Only allow HTTPS
    const host = parsed.hostname.toLowerCase();
    // Check all blocked prefixes
    if (BLOCKED_HOSTS.some((b) => host.startsWith(b))) return true;
    // Block any IP-based hostname (prevents DNS rebinding to internal IPs)
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true;
    if (host.startsWith("[")) return true; // All bracketed IPv6
    return false;
  } catch {
    return true;
  }
}

export async function checkSecondaryApi(
  ip: string,
  apiUrl: string,
  apiKey: string
): Promise<SecondaryApiResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    // Replace {ip} and {key} placeholders in URL, or append as query params
    let url = apiUrl;
    if (url.includes("{ip}")) {
      url = url.replace("{ip}", encodeURIComponent(ip));
    } else {
      url += (url.includes("?") ? "&" : "?") + `ip=${encodeURIComponent(ip)}`;
    }
    if (url.includes("{key}")) {
      url = url.replace("{key}", encodeURIComponent(apiKey));
    }

    if (isInternalUrl(url)) {
      throw new Error("secondary_api_blocked_internal_url");
    }

    const res = await fetch(url, {
      headers: {
        "X-Key": apiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    const body = await res.text();

    if (body.startsWith("<") || body.includes('"error"')) {
      throw new Error("secondary_api_error");
    }

    const data = JSON.parse(body);

    return {
      ip: data.ip || ip,
      block: data.block ?? (data.proxy || data.vpn || data.hosting ? 1 : 0),
      asn: data.asn || 0,
      isp: data.isp || data.org || "",
      countryCode: data.countryCode || data.country_code || "",
      country: data.country || data.countryName || "",
    };
  } finally {
    clearTimeout(timeout);
  }
}
