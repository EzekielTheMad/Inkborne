import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ commit: vi.fn(), resolve: vi.fn(), preview: vi.fn(), revalidate: vi.fn() }));
vi.mock("@/lib/supabase/campaign-monster-instances-server", () => ({ commitCampaignMonsterInstance: mocks.commit, resolveCampaignMonsterInstance: mocks.resolve, previewCampaignMonsterSource: mocks.preview }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { commitCampaignMonster, previewCampaignMonster, resolveCampaignMonster } from "@/app/(app)/campaigns/[id]/monsters/actions";
import { MC, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";
import { redirect } from "next/navigation";
beforeEach(() => vi.clearAllMocks());
describe("campaign monster actions", () => {
  it("delegates authenticated strict DAL and preserves saved receipt despite ordinary cache failure", async () => {
    const saved = { status: "saved", receipt: monsterReceipt() }; mocks.commit.mockResolvedValue(saved); mocks.revalidate.mockImplementation(() => { throw new Error("cache unavailable"); });
    const form = new FormData(); expect(await commitCampaignMonster(MC.campaign, form)).toEqual(saved); expect(mocks.commit).toHaveBeenCalledWith(MC.campaign, form);
    expect(mocks.revalidate).toHaveBeenCalledWith(`/campaigns/${MC.campaign}/monsters`);
  });
  it("does not revalidate refusal or interpret missing receipt as cancellation", async () => {
    mocks.commit.mockResolvedValue({ status: "uncertain", message: "Check." }); await commitCampaignMonster(MC.campaign, new FormData()); expect(mocks.revalidate).not.toHaveBeenCalled();
    mocks.resolve.mockResolvedValue({ status: "absent" }); expect(await resolveCampaignMonster(MC.campaign, MC.operation)).toEqual({ status: "absent" });
  });
  it("returns supported preview or clear refusal without writing", async () => {
    mocks.preview.mockRejectedValue(new Error("Unsupported source")); expect(await previewCampaignMonster(MC.campaign, MC.source, 1)).toMatchObject({ status: "error" }); expect(mocks.commit).not.toHaveBeenCalled();
  });
  it("propagates actual installed framework navigation without disguising it as transport failure", async () => {
    let navigation: unknown; try { redirect("/login"); } catch (error) { navigation = error; }
    mocks.preview.mockRejectedValue(navigation); await expect(previewCampaignMonster(MC.campaign, MC.source, 1)).rejects.toBe(navigation);
  });
});
