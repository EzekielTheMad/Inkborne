import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { createClient } from "@/lib/supabase/server";
import {
  addContentRef,
  getContentRefsByCharacter,
  getCharacterContentRefSnapshot,
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
  content_versions: {
    content_id: validDefinition.id,
    version: validDefinition.version,
    system_id_snapshot: validDefinition.system_id,
    content_type_snapshot: validDefinition.content_type,
    slug_snapshot: validDefinition.slug,
    name_snapshot: validDefinition.name,
    data_snapshot: validDefinition.data,
    effects_snapshot: validDefinition.effects,
    source_snapshot: validDefinition.source,
    scope_snapshot: validDefinition.scope,
    owner_id_snapshot: validDefinition.owner_id,
  },
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
      content_versions: {
        ...validRef.content_versions,
        content_id: "66666666-6666-4666-8666-666666666666",
        slug_snapshot: "broken",
        data_snapshot: { hit_die: "not-a-number" },
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

describe("complete builder snapshot reads",()=>{
  it.each([null,{...validRef.content_versions,version:2},{...validRef.content_versions,content_id:"55555555-5555-4555-8555-555555555555"}])("rejects unreadable or mismatched recorded snapshots instead of treating them as absent",async(snapshot)=>{
    const chain={select:vi.fn().mockReturnThis(),eq:vi.fn().mockResolvedValue({data:[validRef,{...validRef,id:"66666666-6666-4666-8666-666666666666",content_versions:snapshot}],error:null})};
    mockedCreateClient.mockResolvedValue({from:vi.fn().mockReturnValue(chain)} as never);
    await expect(getContentRefsByCharacter(validRef.character_id,{requireCompleteSnapshots:true})).rejects.toThrow("Saved character snapshots could not be read");
  });
  it("accepts the actual fresh-race contract with only a complete parent pin",async()=>{
    const race={...validRef,content_versions:{...validRef.content_versions,content_type_snapshot:"race",slug_snapshot:"human",name_snapshot:"Human",data_snapshot:{size:"Medium",speed:30,ability_bonuses:[],traits:["versatility"],subraces:[],languages:["common"],source_refs:[]}}};
    const chain={select:vi.fn().mockReturnThis(),eq:vi.fn().mockResolvedValue({data:[race],error:null})};
    mockedCreateClient.mockResolvedValue({from:vi.fn().mockReturnValue(chain)} as never);
    const refs=await getContentRefsByCharacter(validRef.character_id,{requireCompleteSnapshots:true});
    expect(refs).toHaveLength(1);expect(refs[0].content_definitions.content_type).toBe("race");
  });
});

describe("document snapshot completeness metadata", () => {
  it("marks every readable exact pin complete", async () => {
    const { chain } = mockSupabase([validRef]);
    chain.eq.mockResolvedValue({ data: [validRef], error: null });
    expect(await getCharacterContentRefSnapshot(validRef.character_id)).toMatchObject({ complete: true, refs: [{ id: validRef.id }] });
  });
  it.each([null, { ...validRef.content_versions, version: 2 }, { ...validRef.content_versions, content_id: "55555555-5555-4555-8555-555555555555" }, { ...validRef.content_versions, data_snapshot: { hit_die: "broken" } }])("reports unreadable/omitted/mismatched pins without breaking degraded sheet reads", async snapshot => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const rows = [validRef, { ...validRef, id: "66666666-6666-4666-8666-666666666666", content_versions: snapshot }];
    const { chain } = mockSupabase(rows);
    chain.eq.mockResolvedValue({ data: rows, error: null });
    const result = await getCharacterContentRefSnapshot(validRef.character_id);
    expect(result.complete).toBe(false);
    expect(result.refs[0].id).toBe(validRef.id);
    expect(await getContentRefsByCharacter(validRef.character_id)).toEqual(result.refs);
    await expect(getContentRefsByCharacter(validRef.character_id, { requireCompleteSnapshots: true })).rejects.toThrow("Saved character snapshots could not be read");
    errorSpy.mockRestore();
  });
});
