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
  createCampaign,
  createCampaignPage,
  joinCampaign,
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
});
