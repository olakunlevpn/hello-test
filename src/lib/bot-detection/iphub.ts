export interface IpHubResult {
  ip: string;
  block: number; // 0=residential, 1=non-residential, 2=unknown
  asn: number;
  isp: string;
  countryCode: string;
  countryName: string;
  hostname?: string;
}

export async function checkIpHub(ip: string, apiKey: string): Promise<IpHubResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(`https://v2.api.iphub.info/ip/${encodeURIComponent(ip)}`, {
      headers: {
        "X-Key": apiKey,
        "Accept": "application/json",
      },
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`iphub_status_${res.status}`);
    }

    const body = await res.text();

    // HTML response = rate limit or server error
    if (body.startsWith("<")) {
      throw new Error("iphub_html_response");
    }

    const data = JSON.parse(body);

    // Check for disabled/expired key
    if (data.hostname && data.hostname.includes("disabled")) {
      throw new Error("iphub_key_disabled");
    }

    return {
      ip: data.ip || ip,
      block: data.block ?? 0,
      asn: data.asn || 0,
      isp: data.isp || "",
      countryCode: data.countryCode || "",
      countryName: data.countryName || "",
      hostname: data.hostname,
    };
  } finally {
    clearTimeout(timeout);
  }
}
