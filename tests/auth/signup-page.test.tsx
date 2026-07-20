import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signup: vi.fn(),
  signInWithOAuth: vi.fn(),
}));

vi.mock("@/app/(auth)/signup/actions", () => ({
  initialSignupState: { error: null },
  signup: mocks.signup,
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { signInWithOAuth: mocks.signInWithOAuth } }),
}));

import SignupPage from "@/app/(auth)/signup/page";

function submitSignup() {
  fireEvent.change(screen.getByRole("textbox", { name: "What should we call you?" }), {
    target: { value: "Tav" },
  });
  fireEvent.change(screen.getByRole("textbox", { name: "Email" }), {
    target: { value: "player@example.test" },
  });
  fireEvent.change(screen.getByLabelText("Choose a password"), {
    target: { value: "not-a-real-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Create account/ }));
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.signup.mockResolvedValue({ error: null });
    mocks.signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("submits named account fields to the signup server action", async () => {
    render(<SignupPage />);

    submitSignup();

    await waitFor(() => expect(mocks.signup).toHaveBeenCalled());
    const formData = mocks.signup.mock.calls[0][1] as FormData;
    expect(Object.fromEntries(formData)).toEqual({
      displayName: "Tav",
      email: "player@example.test",
      password: "not-a-real-password",
    });
  });

  it("renders safe action errors and restores the form", async () => {
    mocks.signup.mockResolvedValue({ error: "Unable to create your account. Please try again." });
    render(<SignupPage />);

    submitSignup();

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Unable to create your account. Please try again.",
    );
    expect(screen.getByRole("button", { name: /Create account/ })).toBeEnabled();
  });

  it("exposes an accessible pending state while creating the account", async () => {
    let finish: ((state: { error: null }) => void) | undefined;
    mocks.signup.mockImplementation(
      () => new Promise((resolve) => { finish = resolve; }),
    );
    render(<SignupPage />);

    submitSignup();

    expect(await screen.findByRole("button", { name: "Creating account..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Creating account");

    await act(async () => finish?.({ error: null }));
  });

  it("keeps OAuth signup client-side with the current callback origin", async () => {
    render(<SignupPage />);

    fireEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    await waitFor(() => {
      expect(mocks.signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: { redirectTo: "http://localhost:3000/auth/callback" },
      });
    });
  });
});
