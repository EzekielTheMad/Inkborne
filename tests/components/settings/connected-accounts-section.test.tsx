import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

import { createClient } from "@/lib/supabase/client";
import {
  ConnectedAccountsSection,
} from "@/components/settings/connected-accounts-section";
import { buildIdentityCallbackUrl } from "@/lib/auth/identity-providers";

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
    getUserIdentities: vi.fn(),
    linkIdentity: vi.fn(),
    unlinkIdentity: vi.fn(),
  };
  mockedCreateClient.mockReturnValue({ auth } as never);
  return auth;
}

describe("ConnectedAccountsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/");
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
    expect(screen.getByRole("button", { name: "Unavailable Discord" })).toBeDisabled();
  });

  it("disables every provider mutation while an identity refresh is pending", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockReturnValue(new Promise(() => undefined));

    render(
      <ConnectedAccountsSection
        identities={[emailIdentity]}
        discordEnabled
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));

    expect(await screen.findByRole("button", { name: "Connect Discord" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Connect Google" })).toBeDisabled();
  });

  it("disables an open disconnect confirmation while another provider starts linking", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockReturnValue(new Promise(() => undefined));

    render(
      <ConnectedAccountsSection
        identities={[emailIdentity, googleIdentity]}
        discordEnabled
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect Discord" }));

    expect(await screen.findByRole("button", { name: "Keep connected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Confirm disconnect" })).toBeDisabled();
  });

  it("starts OAuth linking with the settings callback", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [
        { id: "email-id", identity_id: "email-identity-id", user_id: "user-id", provider: "email" },
      ] },
      error: null,
    });
    auth.linkIdentity.mockResolvedValue({
      data: { provider: "google", url: null },
      error: { message: "Manual linking is disabled" },
    });

    render(<ConnectedAccountsSection identities={[emailIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));

    await waitFor(() => {
      expect(auth.linkIdentity).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: "http://localhost:3000/auth/callback?next=%2Fsettings&linked=google",
          skipBrowserRedirect: true,
        },
      });
    });
    expect(screen.getByRole("alert")).toHaveTextContent("Manual linking is disabled");
  });

  it("stops before linking when current identities cannot be verified", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [] },
      error: { message: "Identity lookup failed" },
    });

    render(<ConnectedAccountsSection identities={[emailIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));

    expect(
      await screen.findByText("We couldn't verify your current login methods. Please try again."),
    ).toBeVisible();
    expect(auth.linkIdentity).not.toHaveBeenCalled();
  });

  it("does not relink a provider that was connected in another session", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [
        { id: "email-id", identity_id: "email-identity-id", user_id: "user-id", provider: "email" },
        { id: "google-id", identity_id: "google-identity-id", user_id: "user-id", provider: "google" },
      ] },
      error: null,
    });

    render(<ConnectedAccountsSection identities={[emailIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect Google" }));

    expect(await screen.findByText("google is already connected")).toBeVisible();
    expect(auth.linkIdentity).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Disconnect Google" })).toBeVisible();
  });

  it("clears one-time callback markers after announcing the result", async () => {
    window.history.replaceState({}, "", "/settings?tab=profile&linked=google");

    render(
      <ConnectedAccountsSection
        identities={[emailIdentity, googleIdentity]}
        linkedProvider="google"
      />,
    );

    expect(screen.getByRole("status")).toHaveTextContent(
      "google connected to this Inkborne profile",
    );
    await waitFor(() => expect(window.location.search).toBe("?tab=profile"));
  });

  it("recovers the controls when an auth operation throws unexpectedly", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockRejectedValue(new Error("Storage unavailable"));

    render(<ConnectedAccountsSection identities={[emailIdentity]} />);
    const connectGoogle = screen.getByRole("button", { name: "Connect Google" });
    fireEvent.click(connectGoogle);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Something went wrong while updating your login methods. Please try again.",
    );
    expect(connectGoogle).toBeEnabled();
  });

  it("unlinks with Supabase's identity_id field", async () => {
    const auth = mockAuth();
    auth.getUserIdentities
      .mockResolvedValueOnce({
        data: { identities: [
          { id: "email-id", identity_id: "email-identity-id", user_id: "user-id", provider: "email" },
          { id: "google-id", identity_id: "google-identity-id", user_id: "user-id", provider: "google" },
        ] },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { identities: [
          { id: "email-id", identity_id: "email-identity-id", user_id: "user-id", provider: "email" },
        ] },
        error: null,
      });
    auth.unlinkIdentity.mockResolvedValue({ data: {}, error: null });

    render(<ConnectedAccountsSection identities={[emailIdentity, googleIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));

    await waitFor(() => {
      expect(auth.unlinkIdentity).toHaveBeenCalledWith({
        id: "google-id",
        identity_id: "google-identity-id",
        user_id: "user-id",
        provider: "google",
      });
    });
    expect(screen.getByRole("status")).toHaveTextContent("google disconnected");
  });

  it("rechecks current identities and blocks disconnecting the last login method", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [
        { id: "google-id", identity_id: "google-identity-id", user_id: "user-id", provider: "google" },
      ] },
      error: null,
    });

    render(<ConnectedAccountsSection identities={[emailIdentity, googleIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));

    expect(await screen.findByText("Cannot disconnect your only login method")).toBeVisible();
    expect(auth.unlinkIdentity).not.toHaveBeenCalled();
  });

  it("keeps the provider connected when Supabase rejects the unlink", async () => {
    const auth = mockAuth();
    auth.getUserIdentities.mockResolvedValue({
      data: { identities: [
        { id: "email-id", identity_id: "email-identity-id", user_id: "user-id", provider: "email" },
        { id: "google-id", identity_id: "google-identity-id", user_id: "user-id", provider: "google" },
      ] },
      error: null,
    });
    auth.unlinkIdentity.mockResolvedValue({
      data: null,
      error: { message: "Identity is still in use" },
    });

    render(<ConnectedAccountsSection identities={[emailIdentity, googleIdentity]} />);
    fireEvent.click(screen.getByRole("button", { name: "Disconnect Google" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm disconnect" }));

    expect(await screen.findByText("Identity is still in use")).toBeVisible();
    expect(screen.getByRole("button", { name: "Disconnect Google" })).toBeVisible();
  });
});
