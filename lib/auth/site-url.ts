type HeadersLike = Pick<Headers, "get">;

function httpOrigin(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("The site URL must use HTTP or HTTPS.");
  }
  return url.origin;
}

export function configuredSiteOrigin(): string | null {
  const configuredUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;
  return configuredUrl ? httpOrigin(configuredUrl) : null;
}

export function trustedRequestOrigin(requestHeaders: HeadersLike): string {
  const configuredOrigin = configuredSiteOrigin();
  if (configuredOrigin) return configuredOrigin;

  const headerOrigin = requestHeaders.get("origin");
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",")[0]?.trim();
  const requestHost = forwardedHost || requestHeaders.get("host")?.trim();

  if (!headerOrigin || !requestHost) {
    throw new Error("The request origin is unavailable.");
  }

  const origin = new URL(httpOrigin(headerOrigin));
  if (origin.host.toLowerCase() !== requestHost.toLowerCase()) {
    throw new Error("The request origin is not trusted.");
  }

  return origin.origin;
}
