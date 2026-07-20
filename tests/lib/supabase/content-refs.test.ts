import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createClient } from "@/lib/supabase/server";
import {
  addContentRef,
  getContentRefsByCharacter,
  parseContentRefWithContent,
  removeContentRefsByChoiceSource,
} from "@/lib/supabase/content-refs";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

const validDefinition = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Wizard",
  slug: "wizard",
  content_type: "class",
  version: 1,
  source: "srd",
  system_id: "22222222-2222-4222-8222-222222222222",
  scope: "platform",
  owner_id: null,
  effects: [],
  data: {
    hit_die: 6,
    spellcasting: null,
    multiclass: { prerequisites: [], proficiencies_gained: [] },
    saving_throws: ["intelligence", "wisdom"],
    starting_proficiencies: [],
    levels: [{ level: 1, features: [], spellcasting: null }],
    source_refs: [],
  },
};

const validRef = {
  id: "33333333-3333-4333-8333-333333333333",
  character_id: "44444444-4444-4444-8444-444444444444",
  content_id: validDefinition.id,
  content_version: 1,
  context: {},
  choice_source: null,
  created_at: "2026-05-19T00:00:00Z",
  content_definitions: validDefinition,
};

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockImplementation(() => chain);
  chain.delete.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);

  const supabase = { from: vi.fn().mockReturnValue(chain) };
  mockedCreateClient.mockResolvedValue(supabase as never);
  return { supabase, chain };
}

describe("parseContentRefWithContent", () => {
  it("validates the ref envelope and its nested definition", () => {
    const result = parseContentRefWithContent(validRef);

    expect(result).toMatchObject({
      id: validRef.id,
      content_id: validDefinition.id,
      content_definitions: {
        id: validDefinition.id,
        slug: "wizard",
        content_type: "class",
      },
    });
  });
});

describe("getContentRefsByCharacter", () => {
  it("returns parsed refs from a successful joined query", async () => {
    const { chain } = mockSupabase([validRef]);
    chain.eq.mockResolvedValue({ data: [validRef], error: null });

    const result = await getContentRefsByCharacter(validRef.character_id);

    expect(result).toHaveLength(1);
    expect(result[0].content_definitions.slug).toBe("wizard");
  });

  it("drops only malformed joined rows", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const badRef = {
      ...validRef,
      id: "55555555-5555-4555-8555-555555555555",
      content_definitions: {
        ...validDefinition,
        id: "66666666-6666-4666-8666-666666666666",
        slug: "broken",
        data: { hit_die: "not-a-number" },
      },
    };
    const { chain } = mockSupabase([validRef, badRef]);
    chain.eq.mockResolvedValue({ data: [validRef, badRef], error: null });

    const result = await getContentRefsByCharacter(validRef.character_id);

    expect(result.map((ref) => ref.id)).toEqual([validRef.id]);
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Bad data for broken (class)"),
      expect.anything(),
    );
    errorSpy.mockRestore();
  });

  it("rejects with the original joined-query error", async () => {
    const queryError = {
      code: "42501",
      message: "RLS denied",
      details: null,
      hint: null,
    };
    const { chain } = mockSupabase(null, queryError);
    chain.eq.mockResolvedValue({ data: null, error: queryError });

    await expect(
      getContentRefsByCharacter(validRef.character_id),
    ).rejects.toBe(queryError);
  });
});

describe("addContentRef", () => {
  it("inserts a content ref and returns the result", async () => {
    const ref = { id: "r1", character_id: "c1", content_id: "cd1" };
    mockSupabase(ref);

    const result = await addContentRef({
      character_id: "c1",
      content_id: "cd1",
      content_version: 1,
      context: { source: "class", level: 1 },
    });

    expect(result).toEqual(ref);
  });
});

describe("removeContentRefsByChoiceSource", () => {
  it("deletes refs matching character and choice_source", async () => {
    const { chain } = mockSupabase(null);
    let callCount = 0;
    chain.eq.mockImplementation(() => {
      callCount += 1;
      if (callCount >= 2) {
        return Promise.resolve({ data: null, error: null }) as never;
      }
      return chain;
    });

    await removeContentRefsByChoiceSource("char-1", "choice-skill-1");

    expect(chain.delete).toHaveBeenCalled();
  });
});
