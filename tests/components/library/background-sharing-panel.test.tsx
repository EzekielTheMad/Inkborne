import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/(app)/homebrew/backgrounds/actions", () => ({
  toggleHomebrewBackgroundCampaignShare: vi.fn(),
}));

import { BackgroundSharingPanel } from "@/components/library/background-sharing-panel";

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

describe("BackgroundSharingPanel", () => {
  it("renders exact campaign controls and immutable version guidance", () => {
    render(
      <BackgroundSharingPanel
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
    expect(screen.getByText(/existing character pins remain unchanged/i)).toBeVisible();
  });

  it("explains the first immutable share from private scope", () => {
    render(
      <BackgroundSharingPanel
        contentId="33333333-3333-4333-8333-333333333333"
        version={2}
        scope="personal"
        sharedCampaignCount={0}
        campaigns={[{ ...campaigns[1], shared: false }]}
      />,
    );

    expect(screen.getByText(/sharing creates version 3 because this background becomes shared/i)).toBeVisible();
    expect(screen.getByText("Private")).toBeVisible();
  });
});
