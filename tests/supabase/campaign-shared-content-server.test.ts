import { beforeEach, describe, expect, it, vi } from "vitest";
const rpc = vi.hoisted(() => vi.fn());
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
import { listCampaignSharedContentForOwner } from "@/lib/supabase/campaign-shared-content-server";
const campaignId = "44444444-4444-4444-8444-444444444444";
const row = { content_id: "33333333-3333-4333-8333-333333333333", name: "Original Lantern", content_type: "item", version: 2,
  source: "homebrew", scope: "shared", owner_id: "11111111-1111-4111-8111-111111111111" };
beforeEach(() => rpc.mockReset());
describe("campaign owner received shared-content DTO", () => {
  it.each(["spell", "feat", "background", "item"])("retains exact %s identity/version and campaign RPC contract", async type => {
    rpc.mockResolvedValue({ data: [{ ...row, content_type: type }], error: null });
    expect(await listCampaignSharedContentForOwner(campaignId)).toEqual([{ contentId: row.content_id, name: row.name, contentType: type,
      version: 2, source: "homebrew", scope: "shared", ownerId: row.owner_id }]);
    expect(rpc).toHaveBeenCalledExactlyOnceWith("list_campaign_shared_content_for_owner", { target_campaign_id: campaignId });
  });
  it("rejects unknown type instead of presenting a custom sharing family", async () => {
    rpc.mockResolvedValue({ data: [{ ...row, content_type: "companion" }], error: null });
    await expect(listCampaignSharedContentForOwner(campaignId)).rejects.toThrow();
  });
  it("does not convert an RPC permission error into a successful empty list", async () => {
    rpc.mockResolvedValue({ data: null, error: Error("Synthetic permission refusal") });
    await expect(listCampaignSharedContentForOwner(campaignId)).rejects.toThrow("Synthetic permission refusal");
  });
});