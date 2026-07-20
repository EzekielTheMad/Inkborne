import { afterEach, describe, expect, it, vi } from "vitest";
import { configuredSiteOrigin, trustedRequestOrigin } from "@/lib/auth/site-url";

describe("trusted auth origins", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("normalizes an explicitly configured site URL", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://inkborne.example/deploy/path");
    expect(configuredSiteOrigin()).toBe("https://inkborne.example");
  });

  it("accepts a browser origin that exactly matches the request host", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    const headers = new Headers({ origin: "http://127.0.0.1:3017", host: "127.0.0.1:3017" });
    expect(trustedRequestOrigin(headers)).toBe("http://127.0.0.1:3017");
  });

  it("uses the first forwarded host from a trusted proxy chain", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    const headers = new Headers({
      origin: "https://preview.inkborne.app",
      host: "internal.vercel.test",
      "x-forwarded-host": "preview.inkborne.app, internal.vercel.test",
    });
    expect(trustedRequestOrigin(headers)).toBe("https://preview.inkborne.app");
  });

  it("rejects mismatched hosts and non-HTTP protocols", () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    expect(() =>
      trustedRequestOrigin(new Headers({ origin: "https://attacker.example", host: "inkborne.app" })),
    ).toThrow("not trusted");
    expect(() =>
      trustedRequestOrigin(new Headers({ origin: "javascript:alert(1)", host: "inkborne.app" })),
    ).toThrow("HTTP or HTTPS");
  });
});
