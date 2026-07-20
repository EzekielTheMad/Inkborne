import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/library/spells/actions", () => ({
  toggleHomebrewSpellCampaignShare: vi.fn(),
}));

import { SpellSharingPanel } from "@/components/library/spell-sharing-panel";
import { toggleHomebrewSpellCampaignShare } from "@/app/(app)/library/spells/actions";

const campaigns = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Tuesday Group",
    shared: true,
    eligible: true,
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    name: "Weekend Game",
    shared: false,
    eligible: true,
  },
];

describe("SpellSharingPanel", () => {
  beforeEach(() => {
    vi.mocked(toggleHomebrewSpellCampaignShare).mockReset();
  });

  it("renders campaign-specific accessible controls and exact version guidance", () => {
    render(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={4}
        scope="shared"
        sharedCampaignCount={1}
        campaigns={campaigns}
      />,
    );

    expect(screen.getByRole("button", { name: "Stop sharing with Tuesday Group" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Share with Weekend Game" })).toBeVisible();
    expect(screen.getByText(/removing final access creates version 5/i)).toBeVisible();
    expect(screen.getByText(/adding this campaign keeps the current version/i)).toBeVisible();
    expect(screen.getByText(/existing character pins remain unchanged and usable/i)).toBeVisible();
  });

  it("explains the first immutable share from private scope", () => {
    render(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={2}
        scope="personal"
        sharedCampaignCount={0}
        campaigns={[{ ...campaigns[1], shared: false }]}
      />,
    );

    expect(screen.getByText(/sharing creates version 3 because this spell becomes shared/i)).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
  });

  it("renders an actionable empty state when there are no compatible campaigns", () => {
    render(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={1}
        scope="personal"
        sharedCampaignCount={0}
        campaigns={[]}
      />,
    );

    expect(screen.getByText(/join or create a d&d 5e \(2014\) campaign/i)).toBeVisible();
  });

  it("lets an author remove a current share after leaving that campaign", () => {
    render(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={4}
        scope="shared"
        sharedCampaignCount={1}
        campaigns={[{ ...campaigns[0], eligible: false, shared: true }]}
      />,
    );

    expect(screen.getByText("No longer a member")).toBeVisible();
    expect(screen.getByRole("button", { name: "Stop sharing with Tuesday Group" })).toBeEnabled();
  });

  it("preserves an earlier share when refreshed props and a second action arrive", async () => {
    const action = vi.mocked(toggleHomebrewSpellCampaignShare);
    action.mockResolvedValueOnce({
      status: "idle",
      message: "Campaign access granted.",
      contentId: "33333333-3333-4333-8333-333333333333",
      campaignId: campaigns[0].id,
      enabled: true,
      version: 2,
      scope: "shared",
      sharedCampaignCount: 1,
    });
    const view = render(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={1}
        scope="personal"
        sharedCampaignCount={0}
        campaigns={campaigns.map((campaign) => ({ ...campaign, shared: false }))}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Share with Tuesday Group" }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop sharing with Tuesday Group" })).toBeVisible();
    });

    view.rerender(
      <SpellSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={2}
        scope="shared"
        sharedCampaignCount={1}
        campaigns={campaigns.map((campaign, index) => ({ ...campaign, shared: index === 0 }))}
      />,
    );
    action.mockResolvedValueOnce({
      status: "idle",
      message: "Campaign access granted.",
      contentId: "33333333-3333-4333-8333-333333333333",
      campaignId: campaigns[1].id,
      enabled: true,
      version: 2,
      scope: "shared",
      sharedCampaignCount: 2,
    });
    fireEvent.click(screen.getByRole("button", { name: "Share with Weekend Game" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Stop sharing with Tuesday Group" })).toBeVisible();
      expect(screen.getByRole("button", { name: "Stop sharing with Weekend Game" })).toBeVisible();
    });
  });
});
