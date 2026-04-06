export interface SecondaryApiResult {
  ip: string;
  block: number;
  asn: number;
  isp: string;
  countryCode: string;
  country: string;
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
