import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  for (const method of [
    "select",
    "eq",
    "in",
    "neq",
    "ilike",
    "filter",
    "order",
  ]) {
    chain[method] = vi.fn(() => chain);
  }
  chain.range = vi.fn();
  chain.maybeSingle = vi.fn();
  return {
    chain,
    from: vi.fn(() => chain),
  };
});

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ from: mocks.from }),
}));

import { parseCompendiumQuery } from "@/lib/compendium/catalog";
import { monsterEnvelope } from "@/tests/fixtures/monsters";
import { npcEnvelope } from "@/tests/fixtures/npcs";
import { companionEnvelope } from "@/tests/fixtures/companions";
import {
  getCompendiumEntry,
  listCompendiumEntries,
} from "@/lib/supabase/compendium-server";

const systemId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const spellRow = {
  id: "11111111-1111-4111-8111-111111111111",
  system_id: systemId,
  name: "Shared Spark",
  slug: "shared-spark",
  content_type: "spell",
  version: 3,
  source: "homebrew",
  scope: "shared",
  owner_id: "44444444-4444-4444-8444-444444444444",
  effects: [],
  data: {
    level: 2,
    school: "evocation",
    casting_time: "1 action",
    range: "60 feet",
    components: ["V", "S"],
    duration: "Instantaneous",
    concentration: false,
    ritual: true,
    description: "A campaign-shared spark.",
    damage: null,
    dc: null,
    classes: ["wizard"],
    subclasses: [],
    dependencies: [],
  },
};

describe("compendium server boundary", () => {
  beforeEach(() => {
    for (const mock of Object.values(mocks.chain)) mock.mockClear();
    mocks.from.mockClear();
  });
  it.each(["all", "mine", "shared", "srd"])("queries companion templates with existing fixed predicates and %s entitlement simulation", async provenance => {
    const row=companionEnvelope();
    const returned=provenance==="srd"?{...row,source:"srd",scope:"platform",owner_id:null}:provenance==="shared"?{...row,scope:"shared",owner_id:"44444444-4444-4444-8444-444444444444"}:row;
    mocks.chain.range.mockResolvedValue({data:[returned],error:null,count:25});
    const query=parseCompendiumQuery({category:"companions",system:systemId,provenance,q:"workshop",page:"2",size:"Small"});
    const result=await listCompendiumEntries(query,userId);
    expect(mocks.from).toHaveBeenCalledWith("content_definitions");expect(mocks.chain.in).toHaveBeenCalledWith("content_type",["companion"]);
    expect(mocks.chain.eq).toHaveBeenCalledWith("system_id",systemId);expect(mocks.chain.eq).toHaveBeenCalledWith("is_retired",false);
    expect(mocks.chain.ilike).toHaveBeenCalledWith("name","%workshop%");expect(mocks.chain.range).toHaveBeenCalledWith(24,47);
    expect(mocks.chain.filter).not.toHaveBeenCalled();expect(mocks.chain.order).toHaveBeenCalledWith("id");
    if(provenance==="mine")expect(mocks.chain.eq).toHaveBeenCalledWith("owner_id",userId);
    if(provenance==="shared")expect(mocks.chain.neq).toHaveBeenCalledWith("owner_id",userId);
    if(provenance==="srd")expect(mocks.chain.eq).toHaveBeenCalledWith("source","srd");
    expect(result.entries[0]).toMatchObject({content_type:"companion",effects:[],data:row.data});expect(result.total).toBe(25);
  });
  it("distinguishes companion read denial, empty and malformed rows without creating or repairing data",async()=>{
    const query=parseCompendiumQuery({category:"companions",system:systemId}),error={code:"42501",message:"Synthetic companion read denial"};
    mocks.chain.range.mockResolvedValue({data:null,error,count:null});await expect(listCompendiumEntries(query,userId)).rejects.toBe(error);
    mocks.chain.range.mockResolvedValue({data:[],error:null,count:0});expect((await listCompendiumEntries(query,userId)).entries).toEqual([]);
    vi.spyOn(console,"error").mockImplementation(()=>{});
    mocks.chain.range.mockResolvedValue({data:[{...companionEnvelope(),effects:[{type:"mechanical",stat:"strength",op:"add",value:2}]}],error:null,count:1});
    expect((await listCompendiumEntries(query,userId)).entries).toEqual([]);
    mocks.chain.maybeSingle.mockResolvedValue({data:companionEnvelope(),error:null});
    expect(await getCompendiumEntry(companionEnvelope().id)).toMatchObject({content_type:"companion"});expect(mocks.chain.eq).toHaveBeenCalledWith("id",companionEnvelope().id);
    expect(mocks.chain.eq).toHaveBeenCalledWith("is_retired",false);
  });

  it.each(["all", "mine", "shared", "srd"])("queries narrative NPCs with bounded fixed filters and %s provenance (mock transport)", async provenance => {
    const row = npcEnvelope();
    const returned = provenance === "srd" ? { ...row, source: "srd", scope: "platform", owner_id: null }
      : provenance === "shared" ? { ...row, scope: "shared", owner_id: "44444444-4444-4444-8444-444444444444" } : row;
    mocks.chain.range.mockResolvedValue({ data: [returned], error: null, count: 25 });
    const query = parseCompendiumQuery({ category: "npcs", system: systemId, provenance, q: "keeper", page: "2", size: "Small", level: "2" });
    const result = await listCompendiumEntries(query, userId);
    expect(mocks.chain.in).toHaveBeenCalledWith("content_type", ["npc"]);
    expect(mocks.chain.eq).toHaveBeenCalledWith("system_id", systemId);
    expect(mocks.chain.eq).toHaveBeenCalledWith("is_retired", false);
    expect(mocks.chain.ilike).toHaveBeenCalledWith("name", "%keeper%");
    expect(mocks.chain.filter).not.toHaveBeenCalled();
    expect(mocks.chain.range).toHaveBeenCalledWith(24, 47);
    if (provenance === "mine") expect(mocks.chain.eq).toHaveBeenCalledWith("owner_id", userId);
    if (provenance === "shared") expect(mocks.chain.neq).toHaveBeenCalledWith("owner_id", userId);
    if (provenance === "srd") expect(mocks.chain.eq).toHaveBeenCalledWith("source", "srd");
    expect(result.entries[0]).toMatchObject({ content_type: "npc", effects: [], data: row.data });
    expect(result.total).toBe(25);
  });

  it("distinguishes NPC read denial from empty/malformed results without creating rows", async () => {
    const query = parseCompendiumQuery({ category: "npcs", system: systemId });
    const error = { code: "42501", message: "Synthetic NPC read denial" };
    mocks.chain.range.mockResolvedValue({ data: null, error, count: null });
    await expect(listCompendiumEntries(query, userId)).rejects.toBe(error);
    mocks.chain.range.mockResolvedValue({ data: [], error: null, count: 0 });
    expect((await listCompendiumEntries(query, userId)).entries).toEqual([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.chain.range.mockResolvedValue({ data: [{ ...npcEnvelope(), effects: [{ type: "mechanical", stat: "strength", op: "add", value: 2 }] }], error: null, count: 1 });
    expect((await listCompendiumEntries(query, userId)).entries).toEqual([]);
    mocks.chain.maybeSingle.mockResolvedValue({ data: npcEnvelope(), error: null });
    expect(await getCompendiumEntry(npcEnvelope().id)).toMatchObject({ content_type: "npc" });
    expect(mocks.chain.eq).toHaveBeenCalledWith("id", npcEnvelope().id);
  });

  it.each(["all", "mine", "shared", "srd"])("queries canonical monsters with fixed filters and %s provenance (mocked transport)", async (provenance) => {
    const row = monsterEnvelope();
    const returned = provenance === "srd" ? { ...row, source: "srd", scope: "platform", owner_id: null }
      : provenance === "shared" ? { ...row, scope: "shared", owner_id: "44444444-4444-4444-8444-444444444444" } : row;
    mocks.chain.range.mockResolvedValue({ data: [returned], error: null, count: 1 });
    const query = parseCompendiumQuery({ category: "monsters", system: systemId, provenance,
      size: "Small", q: "kite", page: "2", sort: "name-desc", school: "evocation", level: "2" });
    const result = await listCompendiumEntries(query, userId);
    expect(mocks.from).toHaveBeenCalledWith("content_definitions");
    expect(mocks.chain.in).toHaveBeenCalledWith("content_type", ["monster"]);
    expect(mocks.chain.eq).toHaveBeenCalledWith("system_id", systemId);
    expect(mocks.chain.eq).toHaveBeenCalledWith("is_retired", false);
    expect(mocks.chain.filter.mock.calls).toEqual([["data->>size", "eq", "Small"]]);
    expect(mocks.chain.ilike).toHaveBeenCalledWith("name", "%kite%");
    expect(mocks.chain.order.mock.calls).toEqual([["name", { ascending: false }], ["id"]]);
    expect(mocks.chain.range).toHaveBeenCalledWith(24, 47);
    if (provenance === "mine") expect(mocks.chain.eq).toHaveBeenCalledWith("owner_id", userId);
    if (provenance === "shared") expect(mocks.chain.neq).toHaveBeenCalledWith("owner_id", userId);
    if (provenance === "srd") expect(mocks.chain.eq).toHaveBeenCalledWith("source", "srd");
    expect(result.entries[0]).toMatchObject({ content_type: "monster", data: row.data });
    expect(mocks.chain).not.toHaveProperty("or");
  });

  it("preserves monster query failures and null detail without inventing authorized rows", async () => {
    const error = { code: "42501", message: "Synthetic denial" };
    mocks.chain.range.mockResolvedValue({ data: null, error, count: null });
    await expect(listCompendiumEntries(parseCompendiumQuery({ category: "monsters", system: systemId }), userId)).rejects.toBe(error);
    mocks.chain.maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await getCompendiumEntry(monsterEnvelope().id)).toBeNull();
  });

  it("queries only current, RLS-visible definitions with bounded pagination", async () => {
    mocks.chain.range.mockResolvedValue({ data: [spellRow], error: null, count: 1 });
    const query = {
      ...parseCompendiumQuery({ category: "spells", system: systemId }),
      system: systemId,
    };

    const result = await listCompendiumEntries(query, userId);

    expect(mocks.from).toHaveBeenCalledWith("content_definitions");
    expect(mocks.from).not.toHaveBeenCalledWith("content_versions");
    expect(mocks.chain.eq).toHaveBeenCalledWith("system_id", systemId);
    expect(mocks.chain.in).toHaveBeenCalledWith("content_type", ["spell"]);
    expect(mocks.chain.eq).toHaveBeenCalledWith("is_retired", false);
    expect(mocks.chain.order).toHaveBeenLastCalledWith("id");
    expect(mocks.chain.range).toHaveBeenCalledWith(0, 23);
    expect(result.entries[0]).toMatchObject({
      id: spellRow.id,
      scope: "shared",
      owner_id: spellRow.owner_id,
      system_id: systemId,
    });
  });

  it("lets database RLS define shared entitlements while applying fixed filters", async () => {
    mocks.chain.range.mockResolvedValue({ data: [spellRow], error: null, count: 1 });
    const query = {
      ...parseCompendiumQuery({
        category: "spells",
        system: systemId,
        provenance: "shared",
        level: "2",
        school: "evocation",
        ritual: "true",
      }),
      system: systemId,
    };

    await listCompendiumEntries(query, userId);

    expect(mocks.chain.eq).toHaveBeenCalledWith("source", "homebrew");
    expect(mocks.chain.neq).toHaveBeenCalledWith("owner_id", userId);
    expect(mocks.chain.filter).toHaveBeenCalledWith("data->>level", "eq", "2");
    expect(mocks.chain.filter).toHaveBeenCalledWith("data->>school", "eq", "evocation");
    expect(mocks.chain.filter).toHaveBeenCalledWith("data->>ritual", "eq", "true");
    expect(mocks.chain).not.toHaveProperty("or");
  });

  it("reads detail from the current catalog rather than immutable character pins", async () => {
    mocks.chain.maybeSingle.mockResolvedValue({ data: spellRow, error: null });

    const result = await getCompendiumEntry(spellRow.id);

    expect(mocks.from).toHaveBeenCalledTimes(1);
    expect(mocks.from).toHaveBeenCalledWith("content_definitions");
    expect(mocks.chain.eq).toHaveBeenCalledWith("id", spellRow.id);
    expect(result).toMatchObject({ id: spellRow.id, version: 3 });
  });
});
