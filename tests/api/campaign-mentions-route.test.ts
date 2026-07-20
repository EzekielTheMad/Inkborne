import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn() }));

import { GET } from "@/app/api/campaigns/[id]/mentions/route";
import { createClient } from "@/lib/supabase/server";

const mockedCreateClient = vi.mocked(createClient);
const campaignId = "11111111-1111-4111-8111-111111111111";

function request(query: string) {
  return new NextRequest(`http://localhost:3000/api/campaigns/${campaignId}/mentions?${query}`);
}

function mockSupabase(rows: unknown[], user: { id: string } | null = { id: "user-1" }) {
  const chain: Record<string, unknown> = { data: rows, error: null };
  for (const method of ["select", "eq", "order", "limit", "ilike"]) {
    chain[method] = vi.fn(() => chain);
  }
  const supabase = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user } }) },
    from: vi.fn(() => chain),
  };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return { supabase, chain };
}

describe("campaign mention search", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid campaign ids", async () => {
    const response = await GET(request("kind=page&q=lore"), {
      params: Promise.resolve({ id: "not-a-uuid" }),
    });
    expect(response.status).toBe(400);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("rejects invalid mention kinds before querying Supabase", async () => {
    const response = await GET(request("kind=npc&q=ada"), {
      params: Promise.resolve({ id: campaignId }),
    });
    expect(response.status).toBe(400);
    expect(mockedCreateClient).not.toHaveBeenCalled();
  });

  it("requires authentication", async () => {
    mockSupabase([], null);
    const response = await GET(request("kind=page&q=lore"), {
      params: Promise.resolve({ id: campaignId }),
    });
    expect(response.status).toBe(401);
  });

  it("returns RLS-filtered campaign pages as page mentions", async () => {
    const { supabase, chain } = mockSupabase([{ id: "page-1", title: "Red Keep" }]);
    const response = await GET(request("kind=page&q=Red"), {
      params: Promise.resolve({ id: campaignId }),
    });

    expect(await response.json()).toEqual([
      { id: "page-1", label: "Red Keep", entityType: "page" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("campaign_pages");
    expect(chain.eq).toHaveBeenCalledWith("campaign_id", campaignId);
    expect(chain.ilike).toHaveBeenCalledWith("title", "%Red%");
  });

  it("returns campaign characters as character mentions", async () => {
    const { supabase, chain } = mockSupabase([{ id: "character-1", name: "Ada" }]);
    const response = await GET(request("kind=character&q=Ada"), {
      params: Promise.resolve({ id: campaignId }),
    });

    expect(await response.json()).toEqual([
      { id: "character-1", label: "Ada", entityType: "character" },
    ]);
    expect(supabase.from).toHaveBeenCalledWith("characters");
    expect(chain.eq).toHaveBeenCalledWith("archived", false);
    expect(chain.ilike).toHaveBeenCalledWith("name", "%Ada%");
  });
});
