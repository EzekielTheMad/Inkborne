import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  login: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/app/(auth)/login/actions", () => ({
  initialLoginState: { error: null },
  login: mocks.login,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: mocks.signInWithOAuth } }),
}));

import LoginPage from "@/app/(auth)/login/page";

function submitCredentials() {
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "player@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Password"), {
    target: { value: "not-a-real-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Sign in/ }));
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.login.mockResolvedValue({ error: null });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("submits named credentials to the password server action", async () => {
    render(<LoginPage />);

    submitCredentials();

    await waitFor(() => expect(mocks.login).toHaveBeenCalled());
    const formData = mocks.login.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(formData)).toEqual({
      email: "player@example.test",
      password: "not-a-real-password",
    });
  });

  it("renders the safe error returned by the action", async () => {
    mocks.login.mockResolvedValue({ error: "Email or password was incorrect." });
    render(<LoginPage />);

    submitCredentials();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Email or password was incorrect.",
    );
    expect(screen.getByRole("button", { name: /Sign in/ })).toBeEnabled();
  });

  it("exposes an accessible pending state while the action runs", async () => {
    let finish: ((state: { error: null }) => void) | undefined;
    mocks.login.mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    render(<LoginPage />);

    submitCredentials();

    expect(await screen.findByRole("button", { name: "Signing in..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Signing in");

    await act(async () => finish?.({ error: null }));
  });

  it("keeps OAuth sign-in client-side with the current callback origin", async () => {
    render(<LoginPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      });
    });
  });
});
