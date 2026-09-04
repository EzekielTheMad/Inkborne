import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getUserIdentities: vi.fn(),
  profileSingle: vi.fn(),
  connectedAccountsProps: vi.fn(),
  passwordProps: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: mocks.getUser,
      getUserIdentities: mocks.getUserIdentities,
    },
    from: () => ({
      select: () => ({
        eq: () => ({ single: mocks.profileSingle }),
      }),
    }),
  }),
}));

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/settings/profile-section", () => ({ ProfileSection: () => null }));
vi.mock("@/components/settings/email-section", () => ({ EmailSection: () => null }));
vi.mock("@/components/settings/appearance-section", () => ({ AppearanceSection: () => null }));
vi.mock("@/components/settings/danger-zone-section", () => ({ DangerZoneSection: () => null }));
vi.mock("@/components/settings/connected-accounts-section", () => ({
  ConnectedAccountsSection: (props: unknown) => {
    mocks.connectedAccountsProps(props);
    return null;
  },
}));
vi.mock("@/components/settings/password-section", () => ({
  PasswordSection: (props: unknown) => {
    mocks.passwordProps(props);
    return null;
  },
}));

import SettingsPage from "@/app/(app)/settings/page";

describe("SettingsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-id",
          email: "promoted@example.com",
          identities: [
            {
              id: "email-id",
              identity_id: "email-identity-id",
              user_id: "user-id",
              provider: "email",
            },
          ],
        },
      },
      error: null,
    });
    mocks.profileSingle.mockResolvedValue({ data: null, error: null });
  });

  it("falls back to the authenticated user snapshot when identity lookup rejects", async () => {
    mocks.getUserIdentities.mockRejectedValue(new Error("Identity lookup failed"));

    render(await SettingsPage({ searchParams: Promise.resolve({}) }));

    expect(mocks.connectedAccountsProps).toHaveBeenCalledWith(expect.objectContaining({
      identities: [{
        id: "email-id",
        identityId: "email-identity-id",
        userId: "user-id",
        provider: "email",
      }],
    }));
    expect(mocks.passwordProps).toHaveBeenCalledWith({
      email: "promoted@example.com",
      hasPasswordIdentity: true,
    });
  });
});
