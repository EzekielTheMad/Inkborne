import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { POST } from "@/app/(auth)/auth/signout/route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

describe("auth sign-out POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("signs out and redirects to /login with a POST-to-GET 303", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({ auth: { signOut } } as never);
    const request = new Request("http://localhost:3000/auth/signout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);

    expect(signOut).toHaveBeenCalledOnce();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("returns to Settings with an explicit error when sign-out fails", async () => {
    const signOut = vi.fn().mockResolvedValue({ error: { message: "Sign-out failed" } });
    mockedCreateClient.mockResolvedValue({ auth: { signOut } } as never);
    const request = new Request("http://localhost:3000/auth/signout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings?signoutError=1",
    );
  });

  it("handles an unexpected sign-out exception without claiming success", async () => {
    const signOut = vi.fn().mockRejectedValue(new Error("Storage unavailable"));
    mockedCreateClient.mockResolvedValue({ auth: { signOut } } as never);
    const request = new Request("http://localhost:3000/auth/signout", {
      method: "POST",
      headers: {
        host: "localhost:3000",
        origin: "http://localhost:3000",
      },
    });

    const response = await POST(request);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/settings?signoutError=1",
    );
  });
});
