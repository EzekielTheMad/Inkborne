import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  buildIdentityCallbackUrl,
  ConnectedAccountsSection,
} from "@/components/settings/connected-accounts-section";

const mockedCreateClient = vi.mocked(createClient);
const emailIdentity = {
  id: "email-id",
  identityId: "email-identity-id",
  userId: "user-id",
  provider: "email",
};
const googleIdentity = {
  id: "google-id",
  identityId: "google-identity-id",
  userId: "user-id",
  provider: "google",
};

function mockAuth() {
  const auth = {
    linkIdentity: vi.fn(),
    unlinkIdentity: vi.fn(),
  };
  mockedCreateClient.mockReturnValue({ auth } as never);
  return auth;
}

describe("ConnectedAccountsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds a callback that returns linked users to settings", () => {
    expect(buildIdentityCallbackUrl("https://inkborne.app", "google")).toBe(
      "https://inkborne.app/auth/callback?next=%2Fsettings&linked=google",
    );
  });

  it("shows connected providers and keeps unconfigured Discord unavailable", () => {
    render(<ConnectedAccountsSection identities={[emailIdentity, googleIdentity]} />);

    expect(screen.getByText("Google")).toBeVisible();
    expect(screen.getByText("Connected")).toBeVisible();
    expect(screen.getByText("Setup required")).toBeVisible();
    expect(screen.getByRole("button", { name: "Unavailable" })).toBeDisabled();
  });

  it("starts OAuth linking with the settings callback", async () => {
    const auth = mockAuth();
    auth.linkIdentity.mockResolvedValue({
      data: { provider: "google", url: null },
      error: { message: "Manual linking is disabled" },
    });

    render(<ConnectedAccountsSection identities={[emailIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await waitFor(() => {
      expect(auth.linkIdentity).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback?next=%2Fsettings&linked=google",
          skipBrowserRedirect: true,
        },
      });
    });
    expect(screen.getByText("Manual linking is disabled")).toBeVisible();
  });

  it("unlinks with Supabase's identity_id field", async () => {
    const auth = mockAuth();
    auth.unlinkIdentity.mockResolvedValue({ data: {}, error: null });

    render(<ConnectedAccountsSection identities={[emailIdentity, googleIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    await waitFor(() => {
      expect(auth.unlinkIdentity).toHaveBeenCalledWith({
        id: "google-id",
        identity_id: "google-identity-id",
        user_id: "user-id",
        provider: "google",
      });
    });
    expect(screen.getByText("google disconnected")).toBeVisible();
  });
});
