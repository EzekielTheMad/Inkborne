import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

class TestRedirect extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

const mockedHeaders = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: mockedHeaders }));
vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new TestRedirect(to);
  }),
}));
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { signup, type SignupActionState } from "@/app/(auth)/signup/actions";

const initialSignupState: SignupActionState = { error: null };
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function signupData(overrides: Record<string, string> = {}) {
  const data = new FormData();
  const fields = {
    displayName: " Tav ",
    email: " player+one@example.test ",
    password: "not-a-real-password",
    ...overrides,
  };
  Object.entries(fields).forEach(([key, value]) => data.set(key, value));
  return data;
}

async function captureRedirect(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    if (error instanceof TestRedirect) return error.to;
    throw error;
  }
  throw new Error("Expected action to redirect");
}

function mockSignup(error: { message: string } | null = null) {
  const signUp = vi.fn().mockResolvedValue({ error });
  mockedCreateClient.mockResolvedValue({ auth: { signUp } } as never);
  return signUp;
}

describe("signup server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "");
    vi.stubEnv("SITE_URL", "");
    mockedHeaders.mockResolvedValue(
      new Headers({ origin: "http://localhost:3000", host: "localhost:3000" }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("creates the account server-side using the configured site URL", async () => {
    vi.stubEnv("NEXT_PUBLIC_SITE_URL", "https://inkborne.example/deploy/path");
    const signUp = mockSignup();

    const target = await captureRedirect(() => signup(initialSignupState, signupData()));

    expect(signUp).toHaveBeenCalledWith({
      email: "player+one@example.test",
      password: "not-a-real-password",
      options: {
        data: { full_name: "Tav" },
        emailRedirectTo: "https://inkborne.example/auth/callback",
      },
    });
    expect(mockedHeaders).not.toHaveBeenCalled();
    expect(target).toBe("/auth/verify?email=player%2Bone%40example.test");
  });

  it("uses a matching request origin and ignores an origin form field", async () => {
    const signUp = mockSignup();
    const data = signupData({ origin: "https://attacker.example" });

    await captureRedirect(() => signup(initialSignupState, data));

    expect(signUp).toHaveBeenCalledWith(
      expect.objectContaining({
        options: expect.objectContaining({
          emailRedirectTo: "http://localhost:3000/auth/callback",
        }),
      }),
    );
  });

  it("rejects a request origin that does not match the trusted host", async () => {
    mockedHeaders.mockResolvedValue(
      new Headers({ origin: "https://attacker.example", host: "inkborne.example" }),
    );

    const result = await signup(initialSignupState, signupData());

    expect(result).toEqual({ error: "Unable to create your account. Please try again." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("does not expose returned or unexpected Supabase failures", async () => {
    mockSignup({ message: "User player+one@example.test already registered" });
    const returned = await signup(initialSignupState, signupData());
    expect(returned.error).not.toContain("player+one@example.test");

    mockedCreateClient.mockRejectedValue(new Error("service-role-secret"));
    const unexpected = await signup(initialSignupState, signupData());
    expect(unexpected).toEqual({ error: "Unable to create your account. Please try again." });
    expect(JSON.stringify(unexpected)).not.toContain("service-role-secret");
  });

  it("validates fields before reading request context or creating a client", async () => {
    const result = await signup(initialSignupState, signupData({ password: "short" }));

    expect(result.error).toContain("at least 8 characters");
    expect(mockedHeaders).not.toHaveBeenCalled();
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
