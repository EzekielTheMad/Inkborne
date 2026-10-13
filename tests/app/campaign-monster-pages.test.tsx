import { beforeEach, describe, expect, it, vi } from "vitest";
import { Children, isValidElement } from "react";
const mocks = vi.hoisted(() => ({ enabled: false, context: vi.fn(), list: vi.fn(), sources: vi.fn(), detail: vi.fn(), resolve: vi.fn(), form: vi.fn(), panel: vi.fn() }));
vi.mock("@/lib/campaigns/monster-instance-schema", async (original) => ({ ...(await original<typeof import("@/lib/campaigns/monster-instance-schema")>()), get CAMPAIGN_MONSTERS_ENABLED() { return mocks.enabled; } }));
vi.mock("@/lib/supabase/campaign-monster-instances-server", () => ({ campaignMonsterContext: mocks.context, listCampaignMonsterInstances: mocks.list, listCampaignMonsterSources: mocks.sources, getCampaignMonsterInstance: mocks.detail, resolveCampaignMonsterInstance: mocks.resolve }));
vi.mock("@/components/campaigns/monster-instance-form", () => ({ MonsterInstanceForm: mocks.form }));
vi.mock("@/components/campaigns/monster-instance-panel", () => ({ MonsterInstancePanel: mocks.panel }));
import Roster from "@/app/(app)/campaigns/[id]/monsters/page";
import Detail, { dynamic } from "@/app/(app)/campaigns/[id]/monsters/[instanceId]/page";
import { MC, monsterDetail, monsterReceipt } from "@/tests/fixtures/campaign-monster-instances";
beforeEach(() => { vi.clearAllMocks(); mocks.enabled = false; });
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

function updateReceipt(noop = false) {
  const receipt = monsterReceipt({ command_version: 1, command: "update", operation_id: MC.operation, instance_id: MC.instance,
    expected_revision: "0", patch: { current_hp: noop ? 0 : 4 } });
  if (noop) { receipt.outcome = "noop"; receipt.readback.revision = "0"; }
  return receipt;
}
function enableOwnerRead() {
  // Simulation only; production gate remains false and real native ownership/ACL proof remains open.
  mocks.enabled = true;
  mocks.context.mockResolvedValue({ ownerId: MC.owner, campaign: { id: MC.campaign, system_id: MC.system, name: "Original synthetic bridge" } });
  mocks.resolve.mockResolvedValue({ status: "saved", receipt: updateReceipt() });
  mocks.detail.mockResolvedValue({ ...monsterDetail("3"), current_hp: 7 });
}
const detailParams = () => Promise.resolve({ id: MC.campaign, instanceId: MC.instance });
const acceptedQuery = () => Promise.resolve({ editAfter: MC.operation });
function formChild(element: Awaited<ReturnType<typeof Detail>>) {
  const child = Children.toArray(element.props.children).find((entry) => isValidElement(entry) && entry.type === mocks.form);
  if (!isValidElement<{ initial: ReturnType<typeof monsterDetail>; ownerId: string }>(child)) throw new Error("Missing actual form child");
  return child;
}
describe("accepted edit generation route with simulated owner/DAL reads only", () => {
  it("forces a fresh request and resolves accepted correspondence before latest detail, with newer bigint revision", async () => {
    enableOwnerRead(); mocks.detail.mockResolvedValue({ ...monsterDetail("9007199254740993"), current_hp: 7 });
    const child = formChild(await Detail({ params: detailParams(), searchParams: acceptedQuery() }));
    expect(dynamic).toBe("force-dynamic"); expect(mocks.context).toHaveBeenCalledWith(MC.campaign);
    expect(mocks.resolve).toHaveBeenCalledWith(MC.campaign, MC.operation); expect(mocks.detail).toHaveBeenCalledWith(MC.campaign, MC.instance);
    expect(mocks.context.mock.invocationCallOrder[0]).toBeLessThan(mocks.resolve.mock.invocationCallOrder[0]);
    expect(mocks.resolve.mock.invocationCallOrder[0]).toBeLessThan(mocks.detail.mock.invocationCallOrder[0]);
    expect(child.props.initial).toMatchObject({ revision: "9007199254740993", current_hp: 7 }); expect(child.props.ownerId).toBe(MC.owner);
    expect(child.key).toContain(MC.operation); expect(mocks.sources).not.toHaveBeenCalled();
  });
  it("an accepted no-op still creates a distinct keyed editor generation at the unchanged revision", async () => {
    enableOwnerRead(); mocks.resolve.mockResolvedValue({ status: "saved", receipt: updateReceipt(true) }); mocks.detail.mockResolvedValue(monsterDetail("0"));
    const ordinary = formChild(await Detail({ params: detailParams() }));
    const accepted = formChild(await Detail({ params: detailParams(), searchParams: acceptedQuery() }));
    expect(accepted.props.initial.revision).toBe("0"); expect(accepted.key).not.toBe(ordinary.key); expect(accepted.key).toContain(MC.operation);
  });
  it.each(["", "not-a-uuid", "ABCDEFAB-0000-4000-8000-000000000006", [MC.operation], [MC.operation, MC.foreign]].map((editAfter) => ({ editAfter })))("rejects noncanonical/non-scalar editAfter %j before resolver or detail", async ({ editAfter }) => {
    enableOwnerRead(); await expect(Detail({ params: detailParams(), searchParams: Promise.resolve({ editAfter }) })).rejects.toThrow();
    expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it.each(["absent", "uncertain", "error", "missing", "malformed", "foreign-campaign", "foreign-operation", "foreign-instance"])("%s receipt cannot admit a latest editor", async (mode) => {
    enableOwnerRead(); const receipt = updateReceipt();
    if (mode === "foreign-campaign") { receipt.campaign_id = MC.foreign; receipt.readback.campaign_id = MC.foreign; }
    if (mode === "foreign-operation") { receipt.operation_id = MC.foreign; receipt.canonical_intent.operation_id = MC.foreign; }
    if (mode === "foreign-instance") { receipt.instance_id = MC.foreign; receipt.readback.id = MC.foreign; if (receipt.canonical_intent.command === "update") receipt.canonical_intent.instance_id = MC.foreign; }
    const response = mode.startsWith("foreign-") ? { status: "saved", receipt } : mode === "absent" ? { status: mode }
      : mode === "missing" ? undefined : mode === "malformed" ? { status: "saved", receipt: {} } : { status: mode, message: "Simulated refusal." };
    mocks.resolve.mockResolvedValue(response);
    await expect(Detail({ params: detailParams(), searchParams: acceptedQuery() })).rejects.toThrow(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it.each(["older", "numeric", "leading-zero", "missing-revision", "foreign-instance", "foreign-campaign", "foreign-system"])("%s latest detail is refused after accepted receipt instead of silently rebasing", async (mode) => {
    enableOwnerRead(); const latest: Record<string, unknown> = { ...monsterDetail("3") };
    if (mode === "older") latest.revision = "0";
    if (mode === "numeric") latest.revision = 3;
    if (mode === "leading-zero") latest.revision = "03";
    if (mode === "missing-revision") delete latest.revision;
    if (mode === "foreign-instance") latest.id = MC.foreign;
    if (mode === "foreign-campaign") latest.campaign_id = MC.foreign;
    if (mode === "foreign-system") latest.system_id = MC.foreign;
    mocks.detail.mockResolvedValue(latest);
    await expect(Detail({ params: detailParams(), searchParams: acceptedQuery() })).rejects.toThrow(); expect(mocks.form).not.toHaveBeenCalled();
  });
  it("current owner absence stops before any receipt/detail disclosure", async () => {
    enableOwnerRead(); mocks.context.mockResolvedValue(null);
    await expect(Detail({ params: detailParams(), searchParams: acceptedQuery() })).rejects.toThrow(); expect(mocks.resolve).not.toHaveBeenCalled(); expect(mocks.detail).not.toHaveBeenCalled();
  });
  it("retired/deleted current definition is not reacquired for historical instance read or replay", async () => {
    enableOwnerRead(); mocks.sources.mockRejectedValue(new Error("Current source retired/deleted; no acquisition available"));
    const child = formChild(await Detail({ params: detailParams(), searchParams: acceptedQuery() }));
    expect(child.props.initial.source_snapshot).toEqual(monsterDetail().source_snapshot); expect(mocks.sources).not.toHaveBeenCalled();
  });
});
