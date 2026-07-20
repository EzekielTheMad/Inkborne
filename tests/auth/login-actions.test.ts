import { beforeEach, describe, expect, it, vi } from "vitest";

class TestRedirect extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new TestRedirect(to);
  }),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

import { login, type LoginActionState } from "@/app/(auth)/login/actions";

const initialLoginState: LoginActionState = { error: null };
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);

function credentials(email = " player@example.test ", password = "not-a-real-password") {
  const data = new FormData();
  data.set("email", email);
  data.set("password", password);
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

describe("login server action", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("signs in through the server Supabase client and redirects on success", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockResolvedValue({ auth: { signInWithPassword } } as never);

    const target = await captureRedirect(() => login(initialLoginState, credentials()));

    expect(signInWithPassword).toHaveBeenCalledWith({
      email: "player@example.test",
      password: "not-a-real-password",
    });
    expect(target).toBe("/dashboard");
  });

  it("returns a safe state when Supabase rejects the credentials", async () => {
    const signInWithPassword = vi.fn().mockResolvedValue({
      error: { message: "Invalid login credentials for player@example.test" },
    });
    mockedCreateClient.mockResolvedValue({ auth: { signInWithPassword } } as never);

    const result = await login(initialLoginState, credentials());

    expect(result).toEqual({ error: "Email or password was incorrect." });
    expect(JSON.stringify(result)).not.toContain("player@example.test");
  });

  it("does not expose unexpected server failures", async () => {
    mockedCreateClient.mockRejectedValue(new Error("service-role-secret"));

    const result = await login(initialLoginState, credentials());

    expect(result).toEqual({ error: "Unable to sign in. Please try again." });
    expect(JSON.stringify(result)).not.toContain("service-role-secret");
  });

  it("validates required credentials before creating a client", async () => {
    const result = await login(initialLoginState, credentials(" ", ""));

    expect(result).toEqual({ error: "Enter your email and password." });
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });
});
