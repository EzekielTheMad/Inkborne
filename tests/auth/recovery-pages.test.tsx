import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const mocks = vi.hoisted(() => ({
  recover: vi.fn(), update: vi.fn(), resend: vi.fn(), push: vi.fn(), email: "player@example.test",
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ auth: {
  resetPasswordForEmail: mocks.recover, updateUser: mocks.update, resend: mocks.resend,
} }) }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(mocks.email ? { email: mocks.email } : {}),
}));

import ForgotPasswordPage from "@/app/(auth)/auth/forgot-password/page";
import ResetPasswordPage from "@/app/(auth)/auth/reset-password/page";
import VerifyPage from "@/app/(auth)/auth/verify/page";
import { ThemeProvider } from "@/components/theme-provider";

function show(page: ReactNode) { return render(<ThemeProvider>{page}</ThemeProvider>); }
function enterPasswords(password = "synthetic-password", confirm = password) {
  fireEvent.change(screen.getByLabelText("New password"), { target: { value: password } });
  fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: confirm } });
  fireEvent.click(screen.getByRole("button", { name: "Update password" }));
}
beforeEach(() => {
  vi.clearAllMocks(); mocks.email = "player@example.test";
  mocks.recover.mockResolvedValue({ error: null });
  mocks.update.mockResolvedValue({ error: null });
  mocks.resend.mockResolvedValue({ error: null });
});

describe("Password recovery presentation preserves SDK contracts", () => {
  it("keeps the recovery origin and replaces the form with a live confirmation", async () => {
    show(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: mocks.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    await waitFor(() => expect(mocks.recover).toHaveBeenCalledWith(mocks.email, {
      redirectTo: "http://localhost:3000/auth/reset-password",
    }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Check your email"));
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login");
  });
  it("disables pending recovery and keeps the email after a failed response", async () => {
    let finish!: (value: { error: { message: string } }) => void;
    mocks.recover.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show(<ForgotPasswordPage />);
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: mocks.email } });
    fireEvent.click(screen.getByRole("button", { name: "Send reset link" }));
    expect(await screen.findByRole("button", { name: "Sending..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Sending reset link");
    await act(async () => finish({ error: { message: "Synthetic email service unavailable." } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic email service unavailable.");
    expect(screen.getByLabelText("Email")).toHaveValue(mocks.email);
    expect(screen.getByRole("button", { name: "Send reset link" })).toBeEnabled();
  });
});

describe("Password update presentation preserves validation and navigation", () => {
  it("rejects mismatched passwords before calling Auth", async () => {
    show(<ResetPasswordPage />);
    enterPasswords("synthetic-password", "different-password");
    expect(await screen.findByRole("alert")).toHaveTextContent("Passwords do not match.");
    expect(mocks.update).not.toHaveBeenCalled();
    expect(screen.getByLabelText("New password")).toHaveValue("synthetic-password");
  });
  it("retains the minimum password-length guard", async () => {
    show(<ResetPasswordPage />);
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "short" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "short" } });
    fireEvent.submit(screen.getByRole("button", { name: "Update password" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Password must be at least 8 characters.");
    expect(mocks.update).not.toHaveBeenCalled();
  });
  it("disables updating, then redirects to the existing login destination", async () => {
    let finish!: (value: { error: null }) => void;
    mocks.update.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show(<ResetPasswordPage />); enterPasswords();
    expect(await screen.findByRole("button", { name: "Updating..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Updating password");
    expect(mocks.update).toHaveBeenCalledWith({ password: "synthetic-password" });
    await act(async () => finish({ error: null }));
    expect(mocks.push).toHaveBeenCalledWith("/login");
  });
  it("retains both fields when Auth rejects the update", async () => {
    mocks.update.mockResolvedValue({ error: { message: "Synthetic expired recovery session." } });
    show(<ResetPasswordPage />); enterPasswords();
    expect(await screen.findByRole("alert")).toHaveTextContent("Synthetic expired recovery session.");
    expect(screen.getByLabelText("Confirm password")).toHaveValue("synthetic-password");
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("Verification presentation preserves resend behavior", () => {
  it("keeps the no-email variant disabled and its restart links", () => {
    mocks.email = ""; show(<VerifyPage />);
    expect(screen.getByRole("button", { name: "Resend email" })).toBeDisabled();
    expect(screen.getByText(/Check your inbox/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Restart" })).toHaveAttribute("href", "/signup");
    expect(screen.getByRole("link", { name: "Back to login" })).toHaveAttribute("href", "/login");
    expect(mocks.resend).not.toHaveBeenCalled();
  });
  it("uses the original signup resend contract and live success notice", async () => {
    show(<VerifyPage />);
    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("Verification email resent."));
    expect(mocks.resend).toHaveBeenCalledWith({ type: "signup", email: mocks.email });
    expect(screen.queryByRole("button", { name: "Resend email" })).not.toBeInTheDocument();
  });
  it("disables resend while pending and announces a retryable failure", async () => {
    let finish!: (value: { error: { message: string } }) => void;
    mocks.resend.mockReturnValue(new Promise(resolve => { finish = resolve; }));
    show(<VerifyPage />);
    fireEvent.click(screen.getByRole("button", { name: "Resend email" }));
    expect(await screen.findByRole("button", { name: "Resending..." })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Resending verification email");
    await act(async () => finish({ error: { message: "Synthetic resend rate limit." } }));
    expect(screen.getByRole("alert")).toHaveTextContent("Synthetic resend rate limit.");
    expect(screen.getByRole("button", { name: "Resend email" })).toBeEnabled();
  });
});
