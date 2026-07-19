import { describe, expect, it } from "vitest";
import {
  canAssignCharacterToCampaign,
  canEditCampaignPage,
  canEditCharacterSheet,
  canViewCampaignPage,
} from "@/lib/campaigns/permissions";

const basePage = {
  campaignOwnerId: "dm-1",
  pageCreatorId: "player-1",
  visibility: "campaign" as const,
};

describe("campaign page permissions", () => {
  it("always lets the campaign owner view and edit pages", () => {
    const access = {
      ...basePage,
      userId: "dm-1",
      isCampaignMember: true,
      visibility: "dm_only" as const,
    };

    expect(canViewCampaignPage(access)).toBe(true);
    expect(canEditCampaignPage(access)).toBe(true);
  });

  it("lets an author see and edit their own DM-only page", () => {
    const access = {
      ...basePage,
      userId: "player-1",
      isCampaignMember: true,
      visibility: "dm_only" as const,
    };

    expect(canViewCampaignPage(access)).toBe(true);
    expect(canEditCampaignPage(access)).toBe(true);
  });

  it("hides DM-only pages from other players", () => {
    const access = {
      ...basePage,
      userId: "player-2",
      isCampaignMember: true,
      visibility: "dm_only" as const,
    };

    expect(canViewCampaignPage(access)).toBe(false);
    expect(canEditCampaignPage(access)).toBe(false);
  });

  it("lets campaign members view shared pages without editing them", () => {
    const access = {
      ...basePage,
      userId: "player-2",
      isCampaignMember: true,
    };

    expect(canViewCampaignPage(access)).toBe(true);
    expect(canEditCampaignPage(access)).toBe(false);
  });

  it("does not expose campaign pages to non-members", () => {
    expect(
      canViewCampaignPage({
        ...basePage,
        userId: "outsider",
        isCampaignMember: false,
      }),
    ).toBe(false);
  });
});

describe("character campaign permissions", () => {
  it("never lets the DM edit a player-owned character sheet", () => {
    expect(canEditCharacterSheet("dm-1", "player-1")).toBe(false);
    expect(canEditCharacterSheet("player-1", "player-1")).toBe(true);
  });

  it("requires campaign access and a matching game system for assignment", () => {
    expect(
      canAssignCharacterToCampaign({
        isCampaignOwner: false,
        isCampaignMember: true,
        characterSystemId: "5e",
        campaignSystemId: "5e",
      }),
    ).toBe(true);
    expect(
      canAssignCharacterToCampaign({
        isCampaignOwner: false,
        isCampaignMember: false,
        characterSystemId: "5e",
        campaignSystemId: "5e",
      }),
    ).toBe(false);
    expect(
      canAssignCharacterToCampaign({
        isCampaignOwner: true,
        isCampaignMember: true,
        characterSystemId: "5e",
        campaignSystemId: "pf2e",
      }),
    ).toBe(false);
  });
});
