import { beforeEach, describe, expect, it, vi } from "vitest";

class TestRedirect extends Error {
  constructor(public to: string) {
    super(`REDIRECT:${to}`);
  }
}

vi.mock("next/navigation", () => ({
  redirect: vi.fn((to: string) => {
    throw new TestRedirect(to);
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/errors", () => ({
  reportServerError: vi.fn().mockResolvedValue(undefined),
}));

import { revalidatePath } from "next/cache";
import {
  assignCharacterToCampaign,
  createCampaign,
  createCampaignPage,
  joinCampaign,
  leaveCampaign,
  removeCampaignMember,
  rotateCampaignInvite,
  unassignCharacterFromCampaign,
  updateCampaign,
  updateCampaignPage,
  type UpdateCampaignPageState,
} from "@/app/(app)/campaigns/actions";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);
const campaignId = "11111111-1111-4111-8111-111111111111";
const systemId = "22222222-2222-4222-8222-222222222222";
const pageId = "33333333-3333-4333-8333-333333333333";

function makeFormData(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

async function captureRedirect(callback: () => Promise<unknown>) {
  try {
    await callback();
  } catch (error) {
    if (error instanceof TestRedirect) return error.to;
    throw error;
  }
  throw new Error("Expected action to redirect");
}

function mockSupabase(options: {
  user?: { id: string } | null;
  insertResult?: { data: { id: string } | null; error: { message: string } | null };
  rpc?: (name: string) => { data: unknown; error: { message: string; code?: string } | null };
} = {}) {
  const user = options.user === undefined ? { id: "user-1" } : options.user;
  const insertResult = options.insertResult ?? { data: { id: campaignId }, error: null };
  const chain = {
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(insertResult),
  };
  const rpc = vi.fn(async (name: string) =>
    options.rpc?.(name) ?? { data: null, error: null },
  );
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn().mockReturnValue(chain),
    rpc,
  };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return { chain, rpc };
}

const idleState: UpdateCampaignPageState = {
  status: "idle",
  message: "",
  revision: 4,
};

describe("campaign actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires authentication before any mutation", async () => {
    mockSupabase({ user: null });
    const target = await captureRedirect(() =>
      joinCampaign(makeFormData({ invite_code: "abcdef123456" })),
    );
    expect(target).toBe("/login");
  });

  it("derives campaign ownership from the authenticated user", async () => {
    const { chain } = mockSupabase();
    const target = await captureRedirect(() =>
      createCampaign(
        makeFormData({ name: " The Long Road ", description: "A test", system_id: systemId }),
      ),
    );

    expect(chain.insert).toHaveBeenCalledWith({
      owner_id: "user-1",
      system_id: systemId,
      name: "The Long Road",
      description: "A test",
    });
    expect(revalidatePath).toHaveBeenCalledWith("/campaigns");
    expect(target).toBe(`/campaigns/${campaignId}`);
  });

  it("joins only through the invite-code RPC", async () => {
    const { rpc } = mockSupabase({
      rpc: (name) => ({ data: name === "join_campaign_by_invite_code" ? campaignId : null, error: null }),
    });
    const target = await captureRedirect(() =>
      joinCampaign(makeFormData({ invite_code: "abcdef123456" })),
    );

    expect(rpc).toHaveBeenCalledWith("join_campaign_by_invite_code", {
      provided_invite_code: "abcdef123456",
    });
    expect(target).toBe(`/campaigns/${campaignId}`);
  });

  it("passes campaign page visibility and parent through the protected RPC", async () => {
    const { rpc } = mockSupabase({
      rpc: (name) => ({ data: name === "create_campaign_page" ? pageId : null, error: null }),
    });
    const target = await captureRedirect(() =>
      createCampaignPage(
        makeFormData({
          campaign_id: campaignId,
          title: "Hidden Harbor",
          visibility: "dm_only",
          parent_id: "",
        }),
      ),
    );

    expect(rpc).toHaveBeenCalledWith("create_campaign_page", {
      target_campaign_id: campaignId,
      page_title: "Hidden Harbor",
      page_visibility: "dm_only",
      parent_page_id: null,
    });
    expect(target).toBe(`/campaigns/${campaignId}/pages/${pageId}`);
  });

  it("returns a recoverable conflict instead of overwriting a stale page", async () => {
    mockSupabase({
      rpc: () => ({
        data: null,
        error: { message: "serialization failure", code: "40001" },
      }),
    });
    const result = await updateCampaignPage(
      idleState,
      makeFormData({
        campaign_id: campaignId,
        page_id: pageId,
        title: "Harbor",
        visibility: "campaign",
        revision: "4",
        content: JSON.stringify({ type: "doc", content: [] }),
      }),
    );

    expect(result.status).toBe("conflict");
    expect(result.revision).toBe(4);
    expect(result.message).toContain("Reload");
  });

  it("returns the new revision after a successful page save", async () => {
    const { rpc } = mockSupabase({
      rpc: (name) => ({ data: name === "update_campaign_page" ? 5 : null, error: null }),
    });
    const result = await updateCampaignPage(
      idleState,
      makeFormData({
        campaign_id: campaignId,
        page_id: pageId,
        title: "Harbor",
        visibility: "campaign",
        revision: "4",
        content: JSON.stringify({ type: "doc", content: [] }),
      }),
    );

    expect(rpc).toHaveBeenCalledWith(
      "update_campaign_page",
      expect.objectContaining({ expected_revision: 4 }),
    );
    expect(result).toEqual({ status: "success", message: "Page saved.", revision: 5 });
  });

  it("updates campaign details only for the authenticated owner", async () => {
    const { chain } = mockSupabase();
    const target = await captureRedirect(() =>
      updateCampaign(
        makeFormData({
          campaign_id: campaignId,
          name: "Revised campaign",
          description: "New description",
        }),
      ),
    );

    expect(chain.insert).not.toHaveBeenCalled();
    expect(chain.update).toHaveBeenCalledWith({
      name: "Revised campaign",
      description: "New description",
    });
    expect(chain.eq).toHaveBeenCalledWith("owner_id", "user-1");
    expect(target).toBe(`/campaigns/${campaignId}/settings?saved=1`);
  });

  it("uses the owner-only RPC when rotating an invite", async () => {
    const { rpc } = mockSupabase({
      rpc: (name) => ({ data: name === "rotate_campaign_invite_code" ? "new-code" : null, error: null }),
    });
    const target = await captureRedirect(() =>
      rotateCampaignInvite(makeFormData({ campaign_id: campaignId })),
    );
    expect(rpc).toHaveBeenCalledWith("rotate_campaign_invite_code", {
      target_campaign_id: campaignId,
    });
    expect(target).toContain("rotated=1");
  });

  it("assigns only the authenticated user's character", async () => {
    const { chain } = mockSupabase();
    const target = await captureRedirect(() =>
      assignCharacterToCampaign(
        makeFormData({ campaign_id: campaignId, character_id: pageId }),
      ),
    );
    expect(chain.update).toHaveBeenCalledWith({ campaign_id: campaignId });
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(target).toBe(`/campaigns/${campaignId}`);
  });

  it("unassigns only the authenticated user's character from the given campaign", async () => {
    const { chain } = mockSupabase();
    await captureRedirect(() =>
      unassignCharacterFromCampaign(
        makeFormData({ campaign_id: campaignId, character_id: pageId }),
      ),
    );
    expect(chain.update).toHaveBeenCalledWith({ campaign_id: null });
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.eq).toHaveBeenCalledWith("campaign_id", campaignId);
  });

  it("leaves through the atomic membership lifecycle RPC", async () => {
    const { rpc } = mockSupabase({ rpc: () => ({ data: null, error: null }) });
    const target = await captureRedirect(() =>
      leaveCampaign(makeFormData({ campaign_id: campaignId })),
    );
    expect(rpc).toHaveBeenCalledWith("leave_campaign", {
      target_campaign_id: campaignId,
    });
    expect(target).toBe("/campaigns");
  });

  it("removes a player through the owner-only lifecycle RPC", async () => {
    const { rpc } = mockSupabase({ rpc: () => ({ data: null, error: null }) });
    const memberUserId = "44444444-4444-4444-8444-444444444444";
    const target = await captureRedirect(() =>
      removeCampaignMember(
        makeFormData({ campaign_id: campaignId, member_user_id: memberUserId }),
      ),
    );
    expect(rpc).toHaveBeenCalledWith("remove_campaign_member", {
      target_campaign_id: campaignId,
      target_user_id: memberUserId,
    });
    expect(target).toBe(`/campaigns/${campaignId}/settings`);
  });
});
