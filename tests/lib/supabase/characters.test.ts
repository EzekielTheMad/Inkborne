import { describe, it, expect, vi } from "vitest";
import { createClient } from "@/lib/supabase/server";
import {
  getCharactersByUser,
  getCharacterById,
  createCharacter,
  updateCharacter,
} from "@/lib/supabase/characters";

// Mock the server client
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

const mockedCreateClient = vi.mocked(createClient);

function mockSupabase(data: unknown, error: unknown = null) {
  const chain = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data, error }),
  };
  chain.select.mockReturnValue(chain);
  chain.order.mockResolvedValue({ data, error });
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);

  const supabase = {
    from: vi.fn().mockReturnValue(chain),
  };

  mockedCreateClient.mockResolvedValue(supabase as never);

  return { supabase, chain };
}

describe("getCharactersByUser", () => {
  it("queries characters filtered by user_id and ordered by created_at", async () => {
    const chars = [{ id: "1", name: "Thorn" }];
    const { chain } = mockSupabase(chars);

    const result = await getCharactersByUser("user-1");

    expect(result).toEqual(chars);
    expect(chain.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(chain.order).toHaveBeenCalledWith("created_at", { ascending: false });
  });
});

describe("getCharacterById", () => {
  it("queries a single character by id", async () => {
    const char = { id: "1", name: "Thorn" };
    const { chain } = mockSupabase(char);

    const result = await getCharacterById("1");

    expect(result).toEqual(char);
    expect(chain.eq).toHaveBeenCalledWith("id", "1");
    expect(chain.single).toHaveBeenCalled();
  });
});

describe("createCharacter", () => {
  it("inserts a character with required fields", async () => {
    const char = { id: "new-1", name: "Elara", user_id: "u1", system_id: "s1" };
    const { chain } = mockSupabase(char);

    const result = await createCharacter({
      name: "Elara",
      user_id: "u1",
      system_id: "s1",
    });

    expect(result).toEqual(char);
    expect(chain.insert).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "Elara",
        user_id: "u1",
        system_id: "s1",
      }),
    ]);
  });
});

describe("updateCharacter", () => {
  it("updates specified fields on a character", async () => {
    const updated = { id: "1", name: "Thorn", level: 2 };
    const { chain } = mockSupabase(updated);

    const result = await updateCharacter("1", { level: 2 });

    expect(result).toEqual(updated);
    expect(chain.update).toHaveBeenCalledWith({ level: 2 });
    expect(chain.eq).toHaveBeenCalledWith("id", "1");
  });
});
