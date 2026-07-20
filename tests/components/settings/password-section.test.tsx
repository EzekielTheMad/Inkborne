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
});
