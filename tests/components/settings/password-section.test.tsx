import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import { PasswordSection } from "@/components/settings/password-section";

const mockedCreateClient = vi.mocked(createClient);

describe("PasswordSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("lets an OAuth-only user add email and password login to the same profile", async () => {
    const updateUser = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockReturnValue({ auth: { updateUser } } as never);

    render(
      <PasswordSection
        hasPasswordIdentity={false}
        email="adventurer@example.com"
      />,
    );

    expect(screen.getByText("Add email & password login")).toBeVisible();
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add email login" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenCalledWith({ password: "A-valid-password-123" });
    });
    expect(
      screen.getByText("Email and password login enabled for adventurer@example.com"),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Update Password" })).toBeVisible();
  });

  it("supports Supabase secure password change reauthentication", async () => {
    const updateUser = vi.fn()
      .mockResolvedValueOnce({
        error: { code: "reauthentication_needed", message: "Reauthentication needed" },
      })
      .mockResolvedValueOnce({ error: null });
    const reauthenticate = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockReturnValue({ auth: { updateUser, reauthenticate } } as never);

    render(
      <PasswordSection
        hasPasswordIdentity={true}
        email="adventurer@example.com"
      />,
    );

    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByLabelText("Security Code")).toBeVisible();
    expect(reauthenticate).toHaveBeenCalledOnce();

    fireEvent.change(screen.getByLabelText("Security Code"), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and update password" }));

    await waitFor(() => {
      expect(updateUser).toHaveBeenLastCalledWith({
        password: "A-valid-password-123",
        nonce: "123456",
      });
    });
    expect(screen.getByText("Password updated successfully")).toBeVisible();
  });

  it("surfaces a reauthentication delivery failure without showing a code field", async () => {
    const updateUser = vi.fn().mockResolvedValue({
      error: { code: "reauthentication_needed", message: "Reauthentication needed" },
    });
    const reauthenticate = vi.fn().mockResolvedValue({
      error: { message: "Security email could not be sent" },
    });
    mockedCreateClient.mockReturnValue({ auth: { updateUser, reauthenticate } } as never);

    render(<PasswordSection hasPasswordIdentity email="adventurer@example.com" />);
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));

    expect(await screen.findByText("Security email could not be sent")).toBeVisible();
    expect(screen.queryByLabelText("Security Code")).not.toBeInTheDocument();
  });

  it("recovers the password controls when Supabase throws unexpectedly", async () => {
    const updateUser = vi.fn().mockRejectedValue(new Error("Storage unavailable"));
    mockedCreateClient.mockReturnValue({ auth: { updateUser } } as never);

    render(<PasswordSection hasPasswordIdentity email="adventurer@example.com" />);
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "A-valid-password-123" },
    });
    const updateButton = screen.getByRole("button", { name: "Update Password" });
    fireEvent.click(updateButton);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong while updating your password. Please try again.",
    );
    expect(updateButton).toBeEnabled();
  });

  it("keeps the security-code form available when nonce verification fails", async () => {
    const updateUser = vi.fn()
      .mockResolvedValueOnce({
        error: { code: "reauthentication_needed", message: "Reauthentication needed" },
      })
      .mockResolvedValueOnce({
        error: { code: "invalid_nonce", message: "Security code is invalid or expired" },
      });
    const reauthenticate = vi.fn().mockResolvedValue({ error: null });
    mockedCreateClient.mockReturnValue({ auth: { updateUser, reauthenticate } } as never);

    render(<PasswordSection hasPasswordIdentity email="adventurer@example.com" />);
    fireEvent.change(screen.getByLabelText("New Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.change(screen.getByLabelText("Confirm Password"), {
      target: { value: "A-valid-password-123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Update Password" }));
    fireEvent.change(await screen.findByLabelText("Security Code"), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Verify and update password" }));

    expect(await screen.findByText("Security code is invalid or expired")).toBeVisible();
    expect(screen.getByLabelText("Security Code")).toHaveValue("000000");
    expect(screen.getByRole("button", { name: "Verify and update password" })).toBeEnabled();

    fireEvent.click(screen.getByRole("button", { name: "Send a new code" }));
    await waitFor(() => expect(reauthenticate).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Security Code")).toHaveValue("");
    expect(screen.getByRole("status")).toHaveTextContent(
      "We sent a new security code to adventurer@example.com.",
    );
  });
});
