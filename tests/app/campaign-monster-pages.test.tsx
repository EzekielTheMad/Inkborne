import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ context: vi.fn(), list: vi.fn(), sources: vi.fn(), detail: vi.fn(), form: vi.fn(), panel: vi.fn() }));
vi.mock("@/lib/supabase/campaign-monster-instances-server", () => ({ campaignMonsterContext: mocks.context, listCampaignMonsterInstances: mocks.list, listCampaignMonsterSources: mocks.sources, getCampaignMonsterInstance: mocks.detail }));
vi.mock("@/components/campaigns/monster-instance-form", () => ({ MonsterInstanceForm: mocks.form }));
vi.mock("@/components/campaigns/monster-instance-panel", () => ({ MonsterInstancePanel: mocks.panel }));
import Roster from "@/app/(app)/campaigns/[id]/monsters/page";
import Detail from "@/app/(app)/campaigns/[id]/monsters/[instanceId]/page";
import { MC } from "@/tests/fixtures/campaign-monster-instances";
beforeEach(() => vi.clearAllMocks());
describe("actual campaign monster routes DEFAULT OFF", () => {
  it("roster stops before Auth, source/list reads or DM props", async () => {
    await expect(Roster({ params: Promise.resolve({ id: MC.campaign }), searchParams: Promise.resolve({}) })).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.list).not.toHaveBeenCalled(); expect(mocks.sources).not.toHaveBeenCalled(); expect(mocks.form).not.toHaveBeenCalled();
  });
  it("detail stops before any instance/private snapshot read", async () => {
    await expect(Detail({ params: Promise.resolve({ id: MC.campaign, instanceId: MC.instance }) })).rejects.toThrow();
    expect(mocks.context).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled(); expect(mocks.form).not.toHaveBeenCalled();
  });
});
