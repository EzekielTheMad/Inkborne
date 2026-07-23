import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/server";
import { GET } from "@/app/(auth)/auth/callback/route";

const mockedCreateClient = vi.mocked(createClient);

function mockExchange(
  error: { message: string } | null,
  identities: Array<{ provider: string }> = [],
  identitiesError: { message: string } | null = null,
) {
  const supabase = {
    auth: {
      exchangeCodeForSession: vi.fn().mockResolvedValue({ error }),
      getUserIdentities: vi.fn().mockResolvedValue({
        data: { identities },
        error: identitiesError,
      }),
    },
  };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return supabase;
}

function callbackRequest(query: string): Request {
  return new Request(`http://localhost:3000/auth/callback?${query}`);
}

function locationOf(res: Response): string {
  return res.headers.get("location") ?? "";
}

describe("auth callback GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects to /login?error=auth when code is missing", async () => {
    const res = await GET(callbackRequest(""));
    expect(locationOf(res)).toBe("http://localhost:3000/login?error=auth");
  });

  it("exchanges code and redirects to /dashboard by default", async () => {
    const supabase = mockExchange(null);
    const res = await GET(callbackRequest("code=abc"));
    expect(supabase.auth.exchangeCodeForSession).toHaveBeenCalledWith("abc");
    expect(locationOf(res)).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to the `next` param when provided", async () => {
    mockExchange(null);
    const res = await GET(callbackRequest("code=abc&next=/characters/123"));
    expect(locationOf(res)).toBe("http://localhost:3000/characters/123");
  });

  it("returns linked OAuth identities to settings with a success marker", async () => {
    mockExchange(null, [{ provider: "google" }]);
    const res = await GET(callbackRequest("code=abc&next=/settings&linked=google"));
    expect(locationOf(res)).toBe("http://localhost:3000/settings?linked=google");
  });

  it("does not report success unless the requested identity is attached", async () => {
    mockExchange(null, [{ provider: "email" }]);
    const res = await GET(callbackRequest("code=abc&next=/settings&linked=google"));
    expect(locationOf(res)).toBe("http://localhost:3000/settings?linkError=google");
  });

  it("does not report success when linked identities cannot be verified", async () => {
    mockExchange(null, [{ provider: "google" }], { message: "Identity lookup failed" });
    const res = await GET(callbackRequest("code=abc&next=/settings&linked=google"));
    expect(locationOf(res)).toBe("http://localhost:3000/settings?linkError=google");
  });

  it("returns failed identity links to settings with an error marker", async () => {
    mockExchange({ message: "invalid grant" });
    const res = await GET(callbackRequest("code=abc&next=/settings&linked=discord"));
    expect(locationOf(res)).toBe("http://localhost:3000/settings?linkError=discord");
  });

  it("ignores unsupported linked-provider markers", async () => {
    const supabase = mockExchange(null, [{ provider: "github" }]);
    const res = await GET(callbackRequest("code=abc&next=/settings&linked=github"));
    expect(locationOf(res)).toBe("http://localhost:3000/settings");
    expect(supabase.auth.getUserIdentities).not.toHaveBeenCalled();
  });

  it("rejects protocol-relative callback destinations", async () => {
    mockExchange(null);
    const res = await GET(callbackRequest("code=abc&next=//example.com"));
    expect(locationOf(res)).toBe("http://localhost:3000/dashboard");
  });

  it("redirects to /auth/reset-password when type is recovery", async () => {
    mockExchange(null);
    // `next` param is ignored when type=recovery so the user always lands on
    // the password reset page.
    const res = await GET(callbackRequest("code=abc&type=recovery&next=/foo"));
    expect(locationOf(res)).toBe("http://localhost:3000/auth/reset-password");
  });

  it("redirects to /login?error=auth when exchange fails", async () => {
    mockExchange({ message: "invalid grant" });
    const res = await GET(callbackRequest("code=abc"));
    expect(locationOf(res)).toBe("http://localhost:3000/login?error=auth");
  });
});
