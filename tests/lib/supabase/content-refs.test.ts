import { describe, it, expect, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  getContentRefsByCharacter,
  addContentRef,
  removeContentRef,
  removeContentRefsByChoiceSource,
  getContentRefsByChoiceSource,
} from "@/lib/supabase/content-refs";

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

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
  // For non-single terminal calls
  chain.delete.mockReturnValue(chain);
  chain.insert.mockReturnValue(chain);

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };

  mockedCreateClient.mockResolvedValue(supabase as never);

  return { supabase, chain };
}

describe("getContentRefsByCharacter", () => {
  it("queries refs with joined content definitions", async () => {
    const refs = [{ id: "r1", content_id: "c1" }];
    const { chain } = mockSupabase(refs);
    // Override: the terminal call for this is the select chain, not single
    chain.eq.mockResolvedValue({ data: refs, error: null });

    const result = await getContentRefsByCharacter("char-1");

    expect(result).toEqual(refs);
  });
});

describe("addContentRef", () => {
  it("inserts a content ref and returns the result", async () => {
    const ref = { id: "r1", character_id: "c1", content_id: "cd1" };
    const { chain } = mockSupabase(ref);

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
    // Chain stays chainable; last eq resolves the promise
    let callCount = 0;
    chain.eq.mockImplementation(() => {
      callCount++;
      if (callCount >= 2) {
        return Promise.resolve({ data: null, error: null });
      }
      return chain;
    });

    await removeContentRefsByChoiceSource("char-1", "choice-skill-1");

    expect(chain.delete).toHaveBeenCalled();
  });
});
