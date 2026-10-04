import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn(), refs: vi.fn(), catalog: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.create }));
vi.mock("@/lib/supabase/content-refs", () => ({ getContentRefsByCharacter: m.refs }));
vi.mock("@/lib/supabase/content-definitions", () => ({ getContentByType: m.catalog }));
vi.mock("next/navigation", () => ({ redirect: vi.fn(), notFound: vi.fn(() => { throw new Error("not found"); }) }));
vi.mock("@/app/(app)/characters/[id]/builder/equipment/equipment-step-client", () => ({ EquipmentStepClient: vi.fn(() => null) }));
import Page from "@/app/(app)/characters/[id]/builder/equipment/page";
let grant: ReturnType<typeof vi.fn>;
const id = "11111111-1111-4111-8111-111111111111";
const receipt = { grant_id: id, inventory_ids: [], plan: { items: [], currency: { gp: 15 } }, awarded_at: "2026-10-04" };
beforeEach(() => {
  vi.resetAllMocks();
  const character = { id, user_id: "owner", choices: {} };
  grant = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST205" } });
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: character }), maybeSingle: grant };
  m.create.mockResolvedValue({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "owner" } } }) }, from: vi.fn().mockReturnValue(chain) });
  m.refs.mockResolvedValue([]);
  m.catalog.mockResolvedValue([]);
});
describe("starting equipment receipt-first reload", () => {
  it.each(["awarded", "inherited_completion"])("renders %s without requiring present catalog or pins", async status => {
    grant.mockResolvedValue({ data: { status, receipt: status === "awarded" ? receipt : null }, error: null });
    m.refs.mockRejectedValue(new Error("unavailable pins"));
    m.catalog.mockRejectedValue(new Error("unavailable catalog"));
    const element = await Page({ params: Promise.resolve({ id }) });
    expect(element.props.completion).toEqual(status === "awarded" ? { status, receipt } : { status });
    expect(element.props.catalog).toEqual([]);
    expect(m.refs).not.toHaveBeenCalled();
    expect(m.catalog).not.toHaveBeenCalled();
  });
  it("preserves existing page loading when staged schema has not been applied", async () => {
    await Page({ params: Promise.resolve({ id }) });
    expect(m.refs).toHaveBeenCalledWith(id, { requireCompleteSnapshots: true });
  });
  it.each(["42501", "NETWORK"])("fails closed on %s receipt read failure", async code => {
    grant.mockResolvedValue({ data: null, error: { code } });
    await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("saved equipment award could not be read");
    expect(m.refs).not.toHaveBeenCalled();
  });
  it("rejects malformed awarded receipts without catalog reconstruction", async () => {
    grant.mockResolvedValue({ data: { status: "awarded", receipt: {} }, error: null });
    await expect(Page({ params: Promise.resolve({ id }) })).rejects.toThrow("saved equipment award could not be read");
    expect(m.refs).not.toHaveBeenCalled();
  });
});
