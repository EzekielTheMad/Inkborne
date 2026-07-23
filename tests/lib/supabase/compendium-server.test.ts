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
