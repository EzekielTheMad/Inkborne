import { beforeEach, describe, expect, it, vi } from "vitest";
const m = vi.hoisted(() => ({ create: vi.fn(), admin: vi.fn(), refs: vi.fn(), catalog: vi.fn(), enabled: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/server", () => ({ createClient: m.create }));
vi.mock("@/lib/supabase/starting-equipment-server", () => ({ createStartingEquipmentClient: m.admin, startingEquipmentEnabled: m.enabled }));
vi.mock("@/lib/supabase/content-refs", () => ({ getContentRefsByCharacter: m.refs }));
vi.mock("@/lib/supabase/content-definitions", () => ({ getContentByType: m.catalog }));
import { confirmStartingEquipment } from "@/app/(app)/characters/[id]/builder/equipment/actions";
const id = "11111111-1111-4111-8111-111111111111";
const sourceId = "22222222-2222-4222-8222-222222222222";
const request = { characterId: id, selections: { selections: { "class:0": "a" }, picks: {} }, sources: { class: { id: sourceId, version: 3 }, background: null } };
const receipt = { grant_id: id, inventory_ids: [id], plan: { items: [{ content_id: null, content_version: null, name: "Mace", content_type: "item", quantity: 1 }], currency: {} }, awarded_at: "2026-10-04T00:00:00Z" };
const character = { id, user_id: "owner", system_id: id, choices: { classes: [{ slug: "fighter" }], starting_equipment: request.selections } };
let rpc: ReturnType<typeof vi.fn>;
let single: ReturnType<typeof vi.fn>;
let auth: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.resetAllMocks();
  rpc = vi.fn().mockImplementation(async name => ({ error: null, data: name === "resolve_starting_equipment" ? { status: "eligible" } : { status: "awarded", receipt } }));
  single = vi.fn().mockResolvedValue({ data: character, error: null });
  auth = vi.fn().mockResolvedValue({ data: { user: { id: "owner" } }, error: null });
  const chain = { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single };
  m.create.mockResolvedValue({ auth: { getUser: auth }, from: vi.fn().mockReturnValue(chain) });
  m.admin.mockReturnValue({ rpc });
  m.enabled.mockReturnValue(true);
  m.refs.mockResolvedValue([{ content_id: sourceId, content_version: 3, content_definitions: { id: sourceId, version: 3, slug: "fighter", content_type: "class", data: { equipment: "A mace or a warhammer" } } }]);
  m.catalog.mockResolvedValue([]);
});
describe("authenticated starting equipment server entry", () => {
  it("derives a bounded plan from fresh pinned sources and saved selections", async () => {
    expect(await confirmStartingEquipment(request)).toEqual({ status: "awarded", receipt });
    expect(m.refs).toHaveBeenCalledWith(id, { requireCompleteSnapshots: true, fresh: true });
    expect(rpc).toHaveBeenLastCalledWith("commit_starting_equipment", {
      actor_id: "owner", target_character_id: id, expected_choices: character.choices,
      expected_refs: [{ content_id: sourceId, content_version: 3 }],
      canonical_intent: { selections: request.selections, sources: request.sources, plan: { items: [{ content_id: null, content_version: null, name: "Mace", content_type: "item", quantity: 1 }], currency: {} } },
    });
  });
  it("resolves the original receipt before the disabled gate or changed/unavailable catalog", async () => {
    m.enabled.mockReturnValue(false);
    m.refs.mockRejectedValue(new Error("deleted pins"));
    rpc.mockResolvedValue({ data: { status: "awarded", receipt }, error: null });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "awarded", receipt });
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(single).not.toHaveBeenCalled();
    expect(m.refs).not.toHaveBeenCalled();
    expect(m.catalog).not.toHaveBeenCalled();
  });
  it.each(["conflict", "not_eligible", "already_completed"])("returns terminal %s without rebuilding or granting", async status => {
    rpc.mockResolvedValue({ data: { status }, error: null });
    expect(await confirmStartingEquipment(request)).toEqual({ status });
    expect(single).not.toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("rejects browser actor, plan, and currency before authentication or RPC", async () => {
    for (const field of ["actor_id", "plan", "currency"]) {
      expect(await confirmStartingEquipment({ ...request, [field]: "forged" })).toEqual({ status: "conflict" });
    }
    expect(m.create).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });
  it("requires verified authentication before constructing the privileged client", async () => {
    auth.mockResolvedValue({ data: { user: null }, error: null });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
    expect(m.admin).not.toHaveBeenCalled();
  });
  it("checks auth errors even when a user object is present", async () => {
    auth.mockResolvedValue({ data: { user: { id: "owner" } }, error: { message: "expired" } });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
    expect(m.admin).not.toHaveBeenCalled();
  });
  it("denies a foreign-owned character after the locked eligibility check", async () => {
    single.mockResolvedValue({ data: { ...character, user_id: "foreign" }, error: null });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it("does not grant eligible characters while the default-off gate is disabled", async () => {
    m.enabled.mockReturnValue(false);
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
    expect(single).not.toHaveBeenCalled();
  });
  it("rejects changed saved picks or source versions", async () => {
    expect(await confirmStartingEquipment({ ...request, selections: { selections: { "class:0": "b" }, picks: {} } })).toEqual({ status: "conflict" });
    expect(await confirmStartingEquipment({ ...request, sources: { ...request.sources, class: { id: sourceId, version: 4 } } })).toEqual({ status: "conflict" });
    expect(rpc.mock.calls.filter(([name]) => name === "commit_starting_equipment")).toHaveLength(0);
  });
  it("denies duplicate primary pins and unreadable snapshots", async () => {
    const refs = await m.refs();
    m.refs.mockResolvedValue([...refs, ...refs]);
    expect(await confirmStartingEquipment(request)).toEqual({ status: "conflict" });
    m.refs.mockRejectedValue(new Error("private snapshot detail"));
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
  });
  it("denies incomplete selections without submitting a grant", async () => {
    single.mockResolvedValue({ data: { ...character, choices: { ...character.choices, starting_equipment: { selections: {}, picks: {} } } }, error: null });
    expect(await confirmStartingEquipment({ ...request, selections: { selections: {}, picks: {} } })).toEqual({ status: "conflict" });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
  it.each(["throw", "error", "malformed"])("classifies %s commit responses as uncertain without replay", async mode => {
    rpc.mockImplementation(async name => {
      if (name === "resolve_starting_equipment") return { data: { status: "eligible" }, error: null };
      if (mode === "throw") throw new Error("private service-role detail");
      return mode === "error" ? { data: null, error: { message: "private service-role detail" } } : { data: { status: "awarded", receipt: {} }, error: null };
    });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "uncertain" });
    expect(rpc).toHaveBeenCalledTimes(2);
  });
  it("keeps unavailable receipt responses closed, even when rollout is enabled", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "missing schema" } });
    expect(await confirmStartingEquipment(request)).toEqual({ status: "unavailable" });
    expect(single).not.toHaveBeenCalled();
  });
});
